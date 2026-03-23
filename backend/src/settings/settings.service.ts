import { Injectable, BadRequestException } from '@nestjs/common';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

const SENSITIVE_KEYS = ['telegram_bot_token', 'jwt_secret', 'app_secret'];

@Injectable()
export class SettingsService {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  async getAll(): Promise<Record<string, string>> {
    const settings = await this.prisma.setting.findMany();
    const result: Record<string, string> = {};

    for (const setting of settings) {
      const decrypted = this.cryptoService.decrypt(
        Buffer.from(setting.value_enc),
        setting.iv,
        setting.tag,
      );

      result[setting.key] = SENSITIVE_KEYS.includes(setting.key)
        ? this.maskValue(decrypted)
        : decrypted;
    }

    return result;
  }

  async get(key: string): Promise<string | null> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) return null;

    return this.cryptoService.decrypt(
      Buffer.from(setting.value_enc),
      setting.iv,
      setting.tag,
    );
  }

  async set(key: string, value: string): Promise<void> {
    const encrypted = this.cryptoService.encrypt(value);

    await this.prisma.setting.upsert({
      where: { key },
      update: {
        value_enc: new Uint8Array(encrypted.encrypted),
        iv: encrypted.iv,
        tag: encrypted.tag,
      },
      create: {
        key,
        value_enc: new Uint8Array(encrypted.encrypted),
        iv: encrypted.iv,
        tag: encrypted.tag,
      },
    });
  }

  async testTelegram(): Promise<{ success: boolean; message: string }> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    if (!this.telegramService.isConfigured()) {
      throw new BadRequestException('Telegram não configurado');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await this.telegramService.sendStatusMessage(
      'Teste de configuração Omnimail',
    );
    return { success: true, message: 'Mensagem de teste enviada com sucesso' };
  }

  private maskValue(value: string): string {
    if (value.length <= 4) return '***CONFIGURED***';
    return '***' + value.slice(-4);
  }
}
