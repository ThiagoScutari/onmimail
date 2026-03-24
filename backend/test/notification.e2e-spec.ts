/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { CryptoModule } from '../src/crypto/crypto.module';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { SettingsModule } from '../src/settings/settings.module';
import { EmailProcessorModule } from '../src/email-processor/email-processor.module';
import { ImapService } from '../src/imap/imap.service';
import { TelegramService } from '../src/telegram/telegram.service';

const TEST_JWT_SECRET = 'test-jwt-secret-for-e2e-testing-only-1234567890abcdef';
const TEST_APP_SECRET =
  'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';

describe('Notification & Settings (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prisma: Record<string, any>;
  let jwtSecret: string;
  let mockTelegram: {
    isConfigured: jest.Mock;
    sendEmailAlert: jest.Mock;
    sendStatusMessage: jest.Mock;
  };
  let mockImap: { fetchEmails: jest.Mock; markAsRead: jest.Mock };

  function generateToken(): string {
    return jwtService.sign(
      { sub: 'user-123', email: 'test@example.com' },
      { secret: jwtSecret, expiresIn: '15m' },
    );
  }

  beforeAll(async () => {
    prisma = {
      email: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        create: jest.fn().mockImplementation((args: any) => ({
          id: 'new-email-id',
          ...args.data,
        })),
      },
      setting: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };

    mockTelegram = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendEmailAlert: jest.fn().mockResolvedValue(undefined),
      sendStatusMessage: jest.fn().mockResolvedValue(undefined),
    };

    mockImap = {
      fetchEmails: jest.fn().mockResolvedValue([]),
      markAsRead: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validationSchema: Joi.object({
            DATABASE_URL: Joi.string()
              .optional()
              .allow('')
              .empty('')
              .default('postgresql://test:test@localhost:5432/test'),
            JWT_SECRET: Joi.string()
              .optional()
              .allow('')
              .empty('')
              .default(TEST_JWT_SECRET),
            APP_SECRET: Joi.string()
              .optional()
              .allow('')
              .empty('')
              .default(TEST_APP_SECRET),
            MONITORED_SENDERS: Joi.string()
              .optional()
              .allow('')
              .default('contabiletica@hotmail.com'),
            FRONTEND_URL: Joi.string()
              .optional()
              .allow('')
              .default('http://localhost:5173'),
            TELEGRAM_BOT_TOKEN: Joi.string().optional().allow('').default(''),
            TELEGRAM_CHAT_ID: Joi.string().optional().allow('').default(''),
          }),
        }),
        PrismaModule,
        CryptoModule,
        AuthModule,
        SettingsModule,
        EmailProcessorModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(TelegramService)
      .useValue(mockTelegram)
      .overrideProvider(ImapService)
      .useValue(mockImap)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    const configService = moduleFixture.get<ConfigService>(ConfigService);
    jwtSecret = configService.get<string>('JWT_SECRET')!;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Email → Telegram notification', () => {
    it('novo email processado → telegramService.sendEmailAlert chamado', async () => {
      mockImap.fetchEmails.mockResolvedValueOnce([
        {
          messageId: 'msg-telegram-test',
          from: 'contabiletica@hotmail.com',
          to: 'thiago@outlook.com',
          subject: 'DARF Urgente',
          body: 'Pagamento pendente',
          date: new Date('2026-03-20'),
          hasAttachments: false,
        },
      ]);
      prisma.email.findUnique.mockResolvedValueOnce(null);

      const token = generateToken();
      await request(app.getHttpServer())
        .post('/emails/sync')
        .set('Authorization', `Bearer ${token}`);

      expect(mockTelegram.sendEmailAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'contabiletica@hotmail.com',
          subject: 'DARF Urgente',
          emailId: 'new-email-id',
        }),
      );
    });

    it('Telegram não configurado → nenhuma exceção', async () => {
      mockTelegram.isConfigured.mockReturnValueOnce(false);
      mockImap.fetchEmails.mockResolvedValueOnce([
        {
          messageId: 'msg-no-telegram',
          from: 'contabiletica@hotmail.com',
          to: 'thiago@outlook.com',
          subject: 'Test',
          body: 'Body',
          date: new Date(),
          hasAttachments: false,
        },
      ]);
      prisma.email.findUnique.mockResolvedValueOnce(null);

      const token = generateToken();
      const res = await request(app.getHttpServer())
        .post('/emails/sync')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(mockTelegram.sendEmailAlert).not.toHaveBeenCalled();
    });
  });

  describe('Settings endpoints', () => {
    it('POST /settings/telegram/test → envia mensagem de teste', async () => {
      mockTelegram.isConfigured.mockReturnValue(true);

      const token = generateToken();
      const res = await request(app.getHttpServer())
        .post('/settings/telegram/test')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(mockTelegram.sendStatusMessage).toHaveBeenCalled();
    });

    it('PUT /settings/:key sem token → 401', async () => {
      const res = await request(app.getHttpServer())
        .put('/settings/telegram_chat_id')
        .send({ value: '123456' });

      expect(res.status).toBe(401);
    });

    it('PUT /settings/:key com token → atualiza configuração', async () => {
      const token = generateToken();
      const res = await request(app.getHttpServer())
        .put('/settings/telegram_chat_id')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: '123456789' });

      expect(res.status).toBe(200);
      expect(res.body.key).toBe('telegram_chat_id');
      expect(res.body.updated).toBe(true);
      expect(prisma.setting.upsert).toHaveBeenCalled();
    });
  });
});
