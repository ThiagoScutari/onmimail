import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import Imap = require('imap');
import { simpleParser } from 'mailparser';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { OAuthService } from '../oauth/oauth.service';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly oauthService: OAuthService,
  ) {}

  private async getSettingValue(key: string): Promise<string | null> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) return null;
    const value = this.cryptoService.decrypt(
      Buffer.from(setting.value_enc),
      setting.iv,
      setting.tag,
    );
    return value && value.trim() !== '' ? value : null;
  }

  private async getConfig(): Promise<Imap.Config> {
    const user = (await this.getSettingValue('imap_user')) || '';
    const password = (await this.getSettingValue('imap_password')) || '';
    const host = (await this.getSettingValue('imap_host')) || '';
    const portStr = await this.getSettingValue('imap_port');
    const port = portStr ? parseInt(portStr, 10) : 993;
    const tlsStr = await this.getSettingValue('imap_tls');
    const tls = tlsStr !== 'false';

    const oauthConnected = await this.oauthService.isConnected();

    if (oauthConnected) {
      const accessToken = await this.oauthService.getAccessToken();
      const xoauth2 = this.oauthService.buildXOAuth2Token(user, accessToken);
      return {
        user,
        password: '',
        xoauth2,
        host,
        port,
        tls,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 30000,
        authTimeout: 30000,
      };
    }

    return {
      user,
      password,
      host,
      port,
      tls,
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
      const imap = new Imap(await this.getConfig());
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
    const imap = new Imap(await this.getConfig());
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
