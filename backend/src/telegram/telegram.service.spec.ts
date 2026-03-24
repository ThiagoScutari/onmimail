import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService, TelegramNotification } from './telegram.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';

const mockSendMessage = jest.fn().mockResolvedValue(true);

jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    sendMessage: mockSendMessage,
  }));
});

describe('TelegramService', () => {
  let service: TelegramService;
  let mockPrisma: Record<string, any>;
  let mockCrypto: Record<string, any>;

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Unconfigured (no settings in DB)', () => {
    beforeEach(async () => {
      mockPrisma = {
        setting: { findUnique: jest.fn().mockResolvedValue(null) },
        email: { count: jest.fn().mockResolvedValue(0) },
      };
      mockCrypto = { decrypt: jest.fn() };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: CryptoService, useValue: mockCrypto },
        ],
      }).compile();

      service = module.get<TelegramService>(TelegramService);
    });

    it('isConfigured() returns false when no settings in DB', async () => {
      expect(await service.isConfigured()).toBe(false);
    });

    it('sendEmailAlert does not throw when unconfigured', async () => {
      const notification: TelegramNotification = {
        from: 'test@test.com',
        subject: 'Test',
        date: '2026-03-23 15:00',
        emailId: 'uuid',
      };
      await expect(service.sendEmailAlert(notification)).resolves.not.toThrow();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Configured (settings in DB)', () => {
    beforeEach(async () => {
      mockPrisma = {
        setting: {
          findUnique: jest
            .fn()
            .mockImplementation(({ where: { key } }: any) => {
              if (key === 'telegram_bot_token')
                return { value_enc: Buffer.from('enc'), iv: 'iv', tag: 'tag' };
              if (key === 'telegram_chat_id')
                return { value_enc: Buffer.from('enc'), iv: 'iv', tag: 'tag' };
              return null;
            }),
        },
        email: { count: jest.fn().mockResolvedValue(5) },
      };
      mockCrypto = {
        decrypt: jest.fn().mockImplementation(() => {
          // Return different values based on call order

          if ((mockCrypto.decrypt as jest.Mock).mock.calls.length % 2 === 1)
            return 'fake-token';
          return '123456';
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: CryptoService, useValue: mockCrypto },
        ],
      }).compile();

      service = module.get<TelegramService>(TelegramService);
    });

    it('isConfigured() returns true when settings exist', async () => {
      expect(await service.isConfigured()).toBe(true);
    });

    it('sendEmailAlert sends formatted Markdown message', async () => {
      const notification: TelegramNotification = {
        from: 'test@contabiletica.com',
        subject: 'Guia do Mes',
        date: '2026-03-23 15:00',
        emailId: 'uuid',
      };
      await service.sendEmailAlert(notification);
      expect(mockSendMessage).toHaveBeenCalledWith(
        '123456',
        expect.stringContaining('URGENTE'),
        { parse_mode: 'Markdown' },
      );
    });

    it('sendEmailAlert does NOT include email body', async () => {
      const notification: TelegramNotification = {
        from: 'test@contabiletica.com',
        subject: 'Guia do Mes',
        date: '2026-03-23 15:00',
        emailId: 'uuid',
      };
      await service.sendEmailAlert(notification);
      const calledText = mockSendMessage.mock.calls[0][1] as string;
      expect(calledText).toContain('test@contabiletica.com');
      expect(calledText).toContain('Guia do Mes');
      expect(calledText).not.toContain('corpo');
    });

    it('sendStatusMessage sends text message', async () => {
      await service.sendStatusMessage('System OK');
      expect(mockSendMessage).toHaveBeenCalledWith(
        '123456',
        expect.stringContaining('System OK'),
        { parse_mode: 'Markdown' },
      );
    });
  });
});
