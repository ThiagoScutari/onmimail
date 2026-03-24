/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { SettingsService } from './settings.service';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

const TEST_APP_SECRET = randomBytes(32).toString('hex');

describe('SettingsService', () => {
  let service: SettingsService;
  let cryptoService: CryptoService;
  let mockPrisma: {
    setting: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let mockTelegram: {
    isConfigured: jest.Mock;
    sendStatusMessage: jest.Mock;
    sendEmailAlert: jest.Mock;
  };

  beforeEach(async () => {
    mockPrisma = {
      setting: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    mockTelegram = {
      isConfigured: jest.fn().mockResolvedValue(false),
      sendStatusMessage: jest.fn().mockResolvedValue(undefined),
      sendEmailAlert: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        CryptoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TelegramService, useValue: mockTelegram },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'APP_SECRET') return TEST_APP_SECRET;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  it('set() criptografa o valor antes de salvar', async () => {
    await service.set('test_key', 'test_value');

    expect(mockPrisma.setting.upsert).toHaveBeenCalledTimes(1);
    const call = mockPrisma.setting.upsert.mock.calls[0][0];

    // value_enc deve ser Uint8Array (criptografado), não a string original
    expect(call.create.value_enc).toBeInstanceOf(Uint8Array);
    expect(call.create.iv).toBeDefined();
    expect(call.create.tag).toBeDefined();
  });

  it('get() descriptografa o valor ao retornar', async () => {
    const encrypted = cryptoService.encrypt('my_secret_value');
    mockPrisma.setting.findUnique.mockResolvedValue({
      key: 'test_key',
      value_enc: encrypted.encrypted,
      iv: encrypted.iv,
      tag: encrypted.tag,
    });

    const result = await service.get('test_key');
    expect(result).toBe('my_secret_value');
  });

  it('getAll() mascara tokens sensíveis', async () => {
    const tokenEnc = cryptoService.encrypt('bot123456:ABCDEFGH');
    const chatEnc = cryptoService.encrypt('987654321');

    mockPrisma.setting.findMany.mockResolvedValue([
      {
        key: 'telegram_bot_token',
        value_enc: tokenEnc.encrypted,
        iv: tokenEnc.iv,
        tag: tokenEnc.tag,
      },
      {
        key: 'telegram_chat_id',
        value_enc: chatEnc.encrypted,
        iv: chatEnc.iv,
        tag: chatEnc.tag,
      },
    ]);

    const result = await service.getAll();

    // telegram_bot_token is sensitive → masked
    expect(result['telegram_bot_token']).not.toBe('bot123456:ABCDEFGH');
    expect(result['telegram_bot_token']).toContain('***');

    // telegram_chat_id is not sensitive → plaintext
    expect(result['telegram_chat_id']).toBe('987654321');
  });

  it('testTelegram() chama TelegramService se configurado', async () => {
    mockTelegram.isConfigured.mockResolvedValue(true);

    const result = await service.testTelegram();

    expect(result.success).toBe(true);
    expect(mockTelegram.sendStatusMessage).toHaveBeenCalledWith(
      'Teste de configuração Omnimail',
    );
  });

  it('testTelegram() lança BadRequestException se não configurado', async () => {
    mockTelegram.isConfigured.mockReturnValue(false);

    await expect(service.testTelegram()).rejects.toThrow(BadRequestException);
    expect(mockTelegram.sendStatusMessage).not.toHaveBeenCalled();
  });
});
