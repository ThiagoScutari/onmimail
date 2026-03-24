/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { CryptoModule } from '../src/crypto/crypto.module';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { EmailsModule } from '../src/emails/emails.module';
import { EmailProcessorModule } from '../src/email-processor/email-processor.module';
import { ImapService } from '../src/imap/imap.service';
import { SettingsModule } from '../src/settings/settings.module';
import { TelegramModule } from '../src/telegram/telegram.module';
import { TelegramService } from '../src/telegram/telegram.service';
import * as bcrypt from 'bcrypt';

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('bcrypt', () => ({
  ...jest.requireActual('bcrypt'),
  compare: jest.fn(),
}));

describe('Flow E2E', () => {
  let app: INestApplication;
  let prisma: Record<string, any>;
  let telegram: Record<string, any>;
  let accessToken: string;

  const mockDbId = 'e2e-msg-idx';

  beforeAll(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      email: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      setting: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),

      $transaction: jest
        .fn()
        .mockImplementation((cb: (p: unknown) => unknown) => cb(prisma)),
    };

    telegram = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendEmailAlert: jest.fn(),
      sendStatusMessage: jest.fn(),
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
              .default('e2e-jwt-secret-123'),
            APP_SECRET: Joi.string()
              .optional()
              .allow('')
              .empty('')
              .default(
                'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
              ),
            MONITORED_SENDERS: Joi.string().optional().allow('').default(''),
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
        EmailsModule,
        EmailProcessorModule,
        SettingsModule,
        TelegramModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ImapService)
      .useValue({
        fetchEmails: jest.fn().mockResolvedValue([
          {
            messageId: 'msg1',
            from: 'a@a.com',
            subject: 'hello',
            date: new Date(),
            body: 'body test',
            hasAttachments: false,
            to: 'me',
          },
        ]),
        markAsRead: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(TelegramService)
      .useValue(telegram)
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    (bcrypt.compare as jest.Mock).mockImplementation(
      (data: string | Buffer, encrypted: string) => {
        return Promise.resolve(encrypted === 'hashed' && data === 'senha123');
      },
    );
  });

  it('1. POST /auth/login → obter accessToken e 401 p/ errada', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    let res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'errado@mail.com', password: 'senhaerrada' });
    expect(res.status).toBe(401);

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'usr1',
      email: 'admin@omnimail.com',
      passwordHash: 'hashed', // will trigger true inside the mock
    });
    res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@omnimail.com', password: 'senha123' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    accessToken = res.body.accessToken as string;
  });

  it('2. POST /emails/sync → processar emails (duplicados)', async () => {
    prisma.email.findUnique.mockResolvedValueOnce(null);
    prisma.email.create.mockResolvedValueOnce({ id: 'ok' });
    const res = await request(app.getHttpServer())
      .post('/emails/sync')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(201);
    expect(res.body.processed).toBeGreaterThanOrEqual(0);

    prisma.email.findUnique.mockResolvedValue({ id: 'exists' });
    const resDup = await request(app.getHttpServer())
      .post('/emails/sync')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(resDup.body.processed).toBe(0);
  });

  it('3. GET /emails → listar emails descriptografados e expiração erro', async () => {
    const resFail = await request(app.getHttpServer()).get('/emails');
    expect(resFail.status).toBe(401);

    prisma.email.findMany.mockResolvedValue([
      {
        id: mockDbId,
        from_enc: Buffer.from('cd75ba'),
        from_iv: '0102030405060708090a0b0c',
        from_tag: '112233445566778899aabbccddeeff00',
        subject_enc: Buffer.from('cd75ba'),
        subject_iv: '0102030405060708090a0b0c',
        subject_tag: '112233445566778899aabbccddeeff00',
        date: new Date(),
        status: 'UNREAD',
        hasAttachments: false,
      },
    ]);
    prisma.email.count.mockResolvedValue(1);

    const res = await request(app.getHttpServer())
      .get('/emails')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('4. GET /emails/:id → erro 404 e depois 200', async () => {
    prisma.email.findUnique.mockResolvedValueOnce(null);
    let res = await request(app.getHttpServer())
      .get('/emails/invalido')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);

    prisma.email.findUnique.mockResolvedValue({
      id: mockDbId,
      body_enc: Buffer.from('cd75ba'),
      body_iv: '0102030405060708090a0b0c',
      body_tag: '112233445566778899aabbccddeeff00',
      to_enc: Buffer.from('cd75ba'),
      to_iv: '0102030405060708090a0b0c',
      to_tag: '112233445566778899aabbccddeeff00',
      from_enc: Buffer.from('cd75ba'),
      from_iv: '0102030405060708090a0b0c',
      from_tag: '112233445566778899aabbccddeeff00',
      subject_enc: Buffer.from('cd75ba'),
      subject_iv: '0102030405060708090a0b0c',
      subject_tag: '112233445566778899aabbccddeeff00',
      date: new Date(),
      status: 'UNREAD',
      hasAttachments: false,
    });
    res = await request(app.getHttpServer())
      .get(`/emails/${mockDbId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it('5. PATCH /emails/:id/status → erro de corpo', async () => {
    let res = await request(app.getHttpServer())
      .patch(`/emails/${mockDbId}/status`)
      .send({ status: 'INVALIDO' })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);

    prisma.email.findUnique.mockResolvedValue({ id: mockDbId });
    prisma.email.update.mockResolvedValue({
      id: mockDbId,
      status: 'READ',
      updatedAt: new Date(),
    });

    res = await request(app.getHttpServer())
      .patch(`/emails/${mockDbId}/status`)
      .send({ status: 'READ' })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it('6. GET /emails?status=READ', async () => {
    const res = await request(app.getHttpServer())
      .get('/emails?status=READ')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it('7. GET /settings → list configs', async () => {
    prisma.setting.findMany.mockResolvedValue([]);
    const res = await request(app.getHttpServer())
      .get('/settings')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('8. PUT /settings/monitored_senders', async () => {
    prisma.setting.upsert.mockResolvedValue({ key: 'monitored_senders' });
    const res = await request(app.getHttpServer())
      .put('/settings/monitored_senders')
      .send({ value: 'teste@mail.com' })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it('9. POST /settings/telegram/test', async () => {
    const res = await request(app.getHttpServer())
      .post('/settings/telegram/test')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(201);
  });
});
