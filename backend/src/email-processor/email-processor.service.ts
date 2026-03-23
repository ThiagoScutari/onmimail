import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImapService } from '../imap/imap.service';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { ParsedEmail } from '../imap/parsed-email.interface';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);

  constructor(
    private readonly imapService: ImapService,
    private readonly cryptoService: CryptoService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
  ) {}

  async processNewEmails(since: Date, senders: string[]): Promise<number> {
    const emails = await this.imapService.fetchEmails(since, senders);
    let processedCount = 0;

    for (const email of emails) {
      const exists = await this.prisma.email.findUnique({
        where: { messageId: email.messageId },
      });

      if (exists) {
        this.logger.debug(`E-mail duplicado ignorado: ${email.messageId}`);
        continue;
      }

      const encryptedData = this.encryptEmailFields(email);

      const saved = await this.prisma.email.create({
        data: {
          messageId: email.messageId,
          from_enc: new Uint8Array(encryptedData.from.encrypted),
          from_iv: encryptedData.from.iv,
          from_tag: encryptedData.from.tag,
          to_enc: new Uint8Array(encryptedData.to.encrypted),
          to_iv: encryptedData.to.iv,
          to_tag: encryptedData.to.tag,
          subject_enc: new Uint8Array(encryptedData.subject.encrypted),
          subject_iv: encryptedData.subject.iv,
          subject_tag: encryptedData.subject.tag,
          body_enc: new Uint8Array(encryptedData.body.encrypted),
          body_iv: encryptedData.body.iv,
          body_tag: encryptedData.body.tag,
          date: email.date,
          hasAttachments: email.hasAttachments,
        },
      });

      processedCount++;
      this.logger.log(`E-mail processado: ${email.messageId}`);

      // Notificação Telegram (usa dados em texto puro da memória, não do BD)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      if (this.telegramService.isConfigured()) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          await this.telegramService.sendEmailAlert({
            from: email.from,
            subject: email.subject,
            date: email.date.toISOString(),
            emailId: saved.id,
          });
        } catch (err) {
          this.logger.error(`Falha ao enviar alerta Telegram: ${err}`);
        }
      }
    }

    return processedCount;
  }

  private encryptEmailFields(email: ParsedEmail) {
    return {
      from: this.cryptoService.encrypt(email.from),
      to: this.cryptoService.encrypt(email.to),
      subject: this.cryptoService.encrypt(email.subject),
      body: this.cryptoService.encrypt(email.body),
    };
  }

  @Cron(CronExpression.EVERY_4_HOURS)
  async handleCron(): Promise<void> {
    this.logger.log('Cronjob de processamento de e-mails iniciado');

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const sendersConfig =
      this.configService.get<string>('MONITORED_SENDERS') ?? '';
    const senders = sendersConfig
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (senders.length === 0) {
      this.logger.warn('Nenhum remetente configurado em MONITORED_SENDERS');
      return;
    }

    const count = await this.processNewEmails(since, senders);
    this.logger.log(`Processados ${count} novos e-mails`);
  }
}
