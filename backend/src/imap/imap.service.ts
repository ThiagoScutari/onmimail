import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import Imap = require('imap');
import { simpleParser } from 'mailparser';

export interface ParsedEmail {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: Date;
  hasAttachments: boolean;
}

export interface ImapServiceInterface {
  fetchEmails(since: Date, senders: string[]): Promise<ParsedEmail[]>;
  markAsRead(messageId: string): Promise<void>;
}

@Injectable()
export class ImapService implements ImapServiceInterface {
  private readonly logger = new Logger(ImapService.name);

  constructor(private readonly configService: ConfigService) {}

  private getConfig(): Imap.Config {
    return {
      user: this.configService.get<string>('IMAP_USER') || '',
      password: this.configService.get<string>('IMAP_PASSWORD') || '',
      host: this.configService.get<string>('IMAP_HOST') || '',
      port: this.configService.get<number>('IMAP_PORT') || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 30000,
      authTimeout: 30000,
    };
  }

  private connect(imap: Imap): Promise<void> {
    return new Promise((resolve, reject) => {
      imap.once('ready', resolve);
      imap.once('error', (err: Error) => reject(err));
      imap.connect();
    });
  }

  private openBox(
    imap: Imap,
    boxName: string,
    readOnly: boolean,
  ): Promise<Imap.Box> {
    return new Promise((resolve, reject) => {
      imap.openBox(boxName, readOnly, (err, box) => {
        if (err) reject(err);
        else resolve(box);
      });
    });
  }

  async fetchEmails(since: Date, senders: string[]): Promise<ParsedEmail[]> {
    let attempt = 0;
    const maxRetries = 3;
    const backoff = [1000, 2000, 4000];

    while (attempt <= maxRetries) {
      const imap = new Imap(this.getConfig());
      try {
        await this.connect(imap);
        await this.openBox(imap, 'INBOX', true);

        return await new Promise<ParsedEmail[]>((resolve, reject) => {
          imap.search(['UNSEEN', ['SINCE', since]], (err, results) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            if (!results || results.length === 0) {
              imap.end();
              return resolve([]);
            }

            const fetch = imap.fetch(results, { bodies: '' });
            const promises: Promise<ParsedEmail | null>[] = [];

            fetch.on('message', (msg) => {
              promises.push(
                new Promise<ParsedEmail | null>((resolveMsg) => {
                  let attributes: Imap.ImapMessageAttributes;

                  msg.on('attributes', (attrs) => {
                    attributes = attrs;
                  });

                  msg.on('body', (stream) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    void simpleParser(stream as any)
                      .then((parsed) => {
                        const from = parsed.from?.text || '';

                        const isWatchedSender = senders.some((sender) => {
                          const s = sender.toLowerCase();
                          if (s.startsWith('*@')) {
                            const domain = s.split('*@')[1];
                            return from.toLowerCase().includes(`@${domain}`);
                          }
                          return from.toLowerCase().includes(s);
                        });

                        if (!isWatchedSender) {
                          resolveMsg(null);
                          return;
                        }

                        let bodyStr = parsed.text || '';
                        if (!bodyStr && parsed.html) {
                          bodyStr = (
                            typeof parsed.html === 'string' ? parsed.html : ''
                          )
                            .replace(/<[^>]*>?/gm, '')
                            .trim()
                            .substring(0, 500);
                        }

                        const email: ParsedEmail = {
                          messageId:
                            parsed.messageId ||
                            attributes?.uid?.toString() ||
                            '',
                          from,
                          to: Array.isArray(parsed.to)
                            ? parsed.to.map((a) => a.text).join(', ')
                            : parsed.to?.text || '',
                          subject: parsed.subject || '',
                          body: bodyStr,
                          date: parsed.date || new Date(),
                          hasAttachments:
                            parsed.attachments && parsed.attachments.length > 0
                              ? true
                              : false,
                        };

                        resolveMsg(email);
                      })
                      .catch(() => resolveMsg(null));
                  });
                }),
              );
            });

            fetch.once('error', (fetchErr) => {
              imap.end();
              reject(fetchErr);
            });

            fetch.once('end', () => {
              void Promise.all(promises).then((allParsed) => {
                imap.end();
                resolve(allParsed.filter((e): e is ParsedEmail => e !== null));
              });
            });
          });
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Imap connect error (Attempt ${attempt + 1}): ${message}`,
        );
        imap.end();
        if (attempt === maxRetries) {
          throw new Error(
            `Timeout/Falha de conexão IMAP após ${maxRetries} tentativas: ${message}`,
          );
        }
        await new Promise((res) => setTimeout(res, backoff[attempt] || 4000));
        attempt++;
      }
    }
    return [];
  }

  async markAsRead(messageId: string): Promise<void> {
    const imap = new Imap(this.getConfig());
    await this.connect(imap);
    await this.openBox(imap, 'INBOX', false);

    return new Promise((resolve, reject) => {
      imap.search([['HEADER', 'MESSAGE-ID', messageId]], (err, results) => {
        if (err || !results || results.length === 0) {
          const uidToSearch = parseInt(messageId, 10);
          if (!isNaN(uidToSearch)) {
            imap.addFlags(uidToSearch, ['\\Seen'], (errFlag) => {
              imap.end();
              if (errFlag) reject(errFlag);
              else resolve();
            });
          } else {
            imap.end();
            resolve();
          }
        } else {
          imap.addFlags(results, ['\\Seen'], (errFlag) => {
            imap.end();
            if (errFlag) reject(errFlag);
            else resolve();
          });
        }
      });
    });
  }
}
