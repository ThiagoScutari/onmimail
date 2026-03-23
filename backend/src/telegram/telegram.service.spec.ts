import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService, TelegramNotification } from './telegram.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const mockSendMessage = jest.fn().mockResolvedValue(true);
const mockOnText = jest.fn();

jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => {
    return {
      sendMessage: mockSendMessage,
      onText: mockOnText,
    };
  });
});

describe('TelegramService', () => {
  let service: TelegramService;

  const mockPrismaService = {
    email: {
      count: jest.fn().mockResolvedValue(5),
    },
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Unconfigured', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('') },
          },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      service = module.get<TelegramService>(TelegramService);
      service.onModuleInit();
    });

    it('isConfigured() returns false when token not in env', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('sendEmailAlert logs warning and does not throw error', async () => {
      const notification: TelegramNotification = {
        from: 'test@test.com',
        subject: 'Test Subject',
        date: '2026-03-23 15:00',
        emailId: 'uuid',
      };
      await expect(service.sendEmailAlert(notification)).resolves.not.toThrow();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Configured', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) =>
                key === 'TELEGRAM_BOT_TOKEN' ? 'token' : 'chat',
              ),
            },
          },
          { provide: PrismaService, useValue: mockPrismaService },
        ],
      }).compile();

      service = module.get<TelegramService>(TelegramService);
      service.onModuleInit();
    });

    it('isConfigured() returns true', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('sendEmailAlert envia mensagem formatada com parse_mode Markdown', async () => {
      const notification: TelegramNotification = {
        from: 'test@contabiletica.com',
        subject: 'Guia do Mes',
        date: '2026-03-23 15:00',
        emailId: 'uuid',
      };
      await service.sendEmailAlert(notification);
      expect(mockSendMessage).toHaveBeenCalledWith(
        'chat',
        expect.stringContaining('URGENTE'),
        { parse_mode: 'Markdown' },
      );
    });

    it('sendEmailAlert NÃO inclui corpo do email', async () => {
      const notification: TelegramNotification = {
        from: 'test@contabiletica.com',
        subject: 'Guia do Mes',
        date: '2026-03-23 15:00',
        emailId: 'uuid',
      };
      await service.sendEmailAlert(notification);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const calledText = mockSendMessage.mock.calls[0][1] as string;
      expect(calledText).toContain('test@contabiletica.com');
      expect(calledText).toContain('Guia do Mes');
      expect(calledText).toContain('2026-03-23 15:00');
      expect(calledText).not.toContain('corpo');
    });

    it('sendStatusMessage envia mensagem de texto', async () => {
      await service.sendStatusMessage('System OK');
      expect(mockSendMessage).toHaveBeenCalledWith(
        'chat',
        expect.stringContaining('System OK'),
        { parse_mode: 'Markdown' },
      );
    });

    it('Comando /status retorna estatisticas', () => {
      expect(mockOnText).toHaveBeenCalledWith(/\/status/, expect.any(Function));
    });
  });
});
