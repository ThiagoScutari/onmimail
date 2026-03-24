import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import TelegramBot = require('node-telegram-bot-api');
import {
  formatNewEmailAlert,
  formatStatusMessage,
  formatGenericStatusMessage,
} from './telegram.templates';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
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
  isConfigured(): Promise<boolean>;
}

@Injectable()
export class TelegramService implements TelegramServiceInterface {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
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

  private async createBot(): Promise<{
    bot: TelegramBot;
    chatId: string;
  } | null> {
    const token = await this.getSettingValue('telegram_bot_token');
    const chatId = await this.getSettingValue('telegram_chat_id');
    if (!token || !chatId) return null;
    const bot = new TelegramBot(token, { polling: false });
    return { bot, chatId };
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

  async isConfigured(): Promise<boolean> {
    const token = await this.getSettingValue('telegram_bot_token');
    const chatId = await this.getSettingValue('telegram_chat_id');
    return token !== null && chatId !== null;
  }

  async sendEmailAlert(notification: TelegramNotification): Promise<void> {
    const conn = await this.createBot();
    if (!conn) {
      this.logger.warn(
        'Tentativa de envio de alerta falhou: Telegram não configurado.',
      );
      return;
    }
    const text = formatNewEmailAlert(notification);
    try {
      await conn.bot.sendMessage(conn.chatId, text, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      this.logger.error('Falha ao enviar alerta via Telegram', error);
    }
  }

  async sendStatusMessage(message: string): Promise<void> {
    const conn = await this.createBot();
    if (!conn) {
      this.logger.warn(
        'Tentativa de envio de status falhou: Telegram não configurado.',
      );
      return;
    }
    const text = formatGenericStatusMessage(message);
    try {
      await conn.bot.sendMessage(conn.chatId, text, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      this.logger.error('Falha ao enviar status via Telegram', error);
    }
  }

  async sendStats(chatId?: string): Promise<void> {
    const conn = await this.createBot();
    if (!conn) return;
    const stats = await this.getEmailStats();
    const text = formatStatusMessage(stats);
    await conn.bot.sendMessage(chatId || conn.chatId, text, {
      parse_mode: 'Markdown',
    });
  }
}
