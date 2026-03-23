import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import TelegramBot = require('node-telegram-bot-api');
import {
  formatNewEmailAlert,
  formatStatusMessage,
  formatGenericStatusMessage,
} from './telegram.templates';
import { PrismaService } from '../prisma/prisma.service';
import { EmailStatus } from '@prisma/client';

export interface TelegramNotification {
  from: string;
  subject: string;
  date: string;
  emailId: string;
}

export interface TelegramServiceInterface {
  sendEmailAlert(notification: TelegramNotification): Promise<void>;
  sendStatusMessage(message: string): Promise<void>;
  isConfigured(): boolean;
}

@Injectable()
export class TelegramService implements TelegramServiceInterface, OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot | null = null;
  private chatId: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID') || null;

    if (token && token.trim() !== '') {
      this.bot = new TelegramBot(token, { polling: true });
      this.logger.log('Telegram Bot inicializado com sucesso.');

      this.bot.onText(/\/status/, (msg) => {
        const handleStatus = async () => {
          const id = msg.chat.id.toString();
          if (this.chatId && id !== this.chatId) {
            return;
          }
          try {
            const stats = await this.getEmailStats();
            const text = formatStatusMessage(stats);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.bot?.sendMessage(id, text, { parse_mode: 'Markdown' });
          } catch (error) {
            this.logger.error('Erro ao processar /status no Telegram', error);
          }
        };
        handleStatus().catch((e: unknown) => this.logger.error(e));
      });
    } else {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN não configurado. Alertas via Telegram desativados.',
      );
    }
  }

  private async getEmailStats() {
    const [total, unread, read, responded] = await Promise.all([
      this.prisma.email.count(),
      this.prisma.email.count({ where: { status: EmailStatus.UNREAD } }),
      this.prisma.email.count({ where: { status: EmailStatus.READ } }),
      this.prisma.email.count({ where: { status: EmailStatus.RESPONDED } }),
    ]);
    return { total, unread, read, responded };
  }

  isConfigured(): boolean {
    return (
      this.bot !== null && this.chatId !== null && this.chatId.trim() !== ''
    );
  }

  async sendEmailAlert(notification: TelegramNotification): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Tentativa de envio de alerta falhou: Telegram não configurado.',
      );
      return;
    }
    const text = formatNewEmailAlert(notification);
    try {
      await this.bot!.sendMessage(this.chatId as string, text, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      this.logger.error('Falha ao enviar alerta via Telegram', error);
    }
  }

  async sendStatusMessage(message: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Tentativa de envio de status falhou: Telegram não configurado.',
      );
      return;
    }
    const text = formatGenericStatusMessage(message);
    try {
      await this.bot!.sendMessage(this.chatId as string, text, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      this.logger.error('Falha ao enviar status via Telegram', error);
    }
  }
}
