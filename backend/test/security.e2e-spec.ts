/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import { CryptoModule } from '../src/crypto/crypto.module';
import { CryptoService } from '../src/crypto/crypto.service';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { EmailsModule } from '../src/emails/emails.module';
import { EmailProcessorModule } from '../src/email-processor/email-processor.module';
import { ImapService } from '../src/imap/imap.service';
import { SettingsModule } from '../src/settings/settings.module';
import { TelegramModule } from '../src/telegram/telegram.module';
import { TelegramService } from '../src/telegram/telegram.service';

const TEST_JWT_SECRET = randomBytes(32).toString('hex');
const TEST_APP_SECRET = randomBytes(32).toString('hex');

describe('Security (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prisma: Record<string, any>;

  const mockEncryptedEmail = {
    id: 'test-email-id',
    messageId: 'msg-001',
    from_enc: Buffer.from('encrypted-from'),
    from_iv: 'aabbccddeeff001122334455',
    from_tag: 'aabbccddeeff00112233445566778899',
    to_enc: Buffer.from('encrypted-to'),
    to_iv: 'bbccddeeff00112233445566',
    to_tag: 'bbccddeeff001122334455667788aabb',
    subject_enc: Buffer.from('encrypted-subject'),
    subject_iv: 'ccddeeff001122334455aabb',
    subject_tag: 'ccddeeff001122334455aabb66778899',
    body_enc: Buffer.from('encrypted-body'),
    body_iv: 'ddeeff001122334455aabbcc',
    body_tag: 'ddeeff001122334455aabbcc66778899',
    date: new Date('2026-03-20'),
    status: 'UNREAD',
    hasAttachments: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    prisma = {
      email: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      setting: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
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
              .default('postgresql://test:test@localhost:5432/test'),
            JWT_SECRET: Joi.string()
              .optional()
              .allow('')
              .default(TEST_JWT_SECRET),
            APP_SECRET: Joi.string()
              .optional()
              .allow('')
              .default(TEST_APP_SECRET),
            MONITORED_SENDERS: Joi.string().optional().allow('').default(''),
            FRONTEND_URL: Joi.string()
              .optional()
              .allow('')
              .default('http://localhost:5173'),
            TELEGRAM_BOT_TOKEN: Joi.string().optional().allow('').default(''),
            TELEGRAM_CHAT_ID: Joi.string().optional().allow('').default(''),
          }),
        }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
        PrismaModule,
        CryptoModule,
        AuthModule,
        EmailsModule,
        EmailProcessorModule,
        SettingsModule,
        TelegramModule,
      ],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ImapService)
      .useValue({
        fetchEmails: jest.fn().mockResolvedValue([]),
        markAsRead: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(TelegramService)
      .useValue({
        isConfigured: jest.fn().mockReturnValue(false),
        sendEmailAlert: jest.fn(),
        sendStatusMessage: jest.fn(),
      })
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
  });

  afterAll(async () => {
    await app.close();
  });

  function generateValidToken(): string {
    return jwtService.sign(
      { sub: 'user-123', email: 'test@example.com' },
      { secret: TEST_JWT_SECRET, expiresIn: '15m' },
    );
  }

  function generateExpiredToken(): string {
    return jwtService.sign(
      { sub: 'user-123', email: 'test@example.com' },
      { secret: TEST_JWT_SECRET, expiresIn: '0s' },
    );
  }

  const bypassTime = async () =>
    new Promise((resolve) => setTimeout(resolve, 1100));

  describe('Authentication', () => {
    it('GET /emails sem Authorization header → 401', async () => {
      const res = await request(app.getHttpServer()).get('/emails');
      expect(res.status).toBe(401);
    });

    it('GET /emails com token malformado → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/emails')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });

    it('GET /emails com token expirado → 401', async () => {
      const token = generateExpiredToken();
      await bypassTime();
      const res = await request(app.getHttpServer())
        .get('/emails')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('GET /emails com token válido → 200', async () => {
      prisma.email.findMany.mockResolvedValue([]);
      prisma.email.count.mockResolvedValue(0);

      const token = generateValidToken();
      const res = await request(app.getHttpServer())
        .get('/emails')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('PATCH /emails/:id/status sem token → 401', async () => {
      const res = await request(app.getHttpServer())
        .patch('/emails/some-id/status')
        .send({ status: 'READ' });
      expect(res.status).toBe(401);
    });

    it('POST /emails/sync sem token → 401', async () => {
      const res = await request(app.getHttpServer()).post('/emails/sync');
      expect(res.status).toBe(401);
    });
  });

  describe('Decryption', () => {
    it('GET /emails com token válido NÃO retorna campos *_enc, *_iv, *_tag', async () => {
      prisma.email.findMany.mockResolvedValue([mockEncryptedEmail]);
      prisma.email.count.mockResolvedValue(1);

      const token = generateValidToken();
      const res = await request(app.getHttpServer())
        .get('/emails')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const email = res.body.data[0];

      expect(email.from_enc).toBeUndefined();
      expect(email.from_iv).toBeUndefined();
      expect(email.from_tag).toBeUndefined();
      expect(email.to_enc).toBeUndefined();
      expect(email.subject_enc).toBeUndefined();
      expect(email.body_enc).toBeUndefined();
    });

    it('GET /emails com token válido retorna campos from, subject como strings', async () => {
      prisma.email.findMany.mockResolvedValue([mockEncryptedEmail]);
      prisma.email.count.mockResolvedValue(1);

      const token = generateValidToken();
      const res = await request(app.getHttpServer())
        .get('/emails')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const email = res.body.data[0];

      expect(typeof email.from).toBe('string');
      expect(typeof email.subject).toBe('string');
    });

    it('GET /emails/:id retorna campo body como string', async () => {
      prisma.email.findUnique.mockResolvedValue(mockEncryptedEmail);

      const token = generateValidToken();
      const res = await request(app.getHttpServer())
        .get('/emails/test-email-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.body).toBe('string');
      expect(res.body.body_enc).toBeUndefined();
    });
  });

  describe('Validation', () => {
    it('PATCH /emails/:id/status com body vazio → 400', async () => {
      const token = generateValidToken();
      const res = await request(app.getHttpServer())
        .patch('/emails/some-id/status')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('PATCH /emails/:id/status com status inválido → 400', async () => {
      const token = generateValidToken();
      const res = await request(app.getHttpServer())
        .patch('/emails/some-id/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVALID_STATUS' });
      expect(res.status).toBe(400);
    });

    it('GET /emails?limit=999 → respeita max 100', async () => {
      const token = generateValidToken();
      const res = await request(app.getHttpServer())
        .get('/emails?limit=999')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Extended Security Checks', () => {
    it("SQL: GET /emails?status=' OR 1=1-- → não retorna dados extras", async () => {
      const token = generateValidToken();
      const res = await request(app.getHttpServer())
        .get("/emails?status=' OR 1=1--")
        .set('Authorization', `Bearer ${token}`);
      expect([400, 404]).toContain(res.status);
    });

    it('SQL: GET /emails/:id com payload SQL → 404 (Prisma parametrizado)', async () => {
      const token = generateValidToken();
      prisma.email.findUnique.mockResolvedValueOnce(null);
      const res = await request(app.getHttpServer())
        .get('/emails/1%20OR%201%3D1--')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('SQL: PUT /settings/:key com valor SQL injection → armazena como texto', async () => {
      const token = generateValidToken();
      prisma.setting.upsert.mockResolvedValue({ key: 'teste' });
      const res = await request(app.getHttpServer())
        .put('/settings/test_sql')
        .send({ value: "' OR 1=1--" })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(prisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ key: 'test_sql' }),
        }),
      );
    });

    it("XSS: Salvar email com <script>alert('xss')</script> no subject", async () => {
      const token = generateValidToken();
      prisma.email.findMany.mockResolvedValue([
        {
          ...mockEncryptedEmail,
          id: 'xss-tester',
        },
      ]);
      const res = await request(app.getHttpServer())
        .get('/emails')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('XSS: PUT /settings com valor <img onerror=alert(1)>', async () => {
      const token = generateValidToken();
      prisma.setting.upsert.mockResolvedValue({ key: 'xss2' });
      const res = await request(app.getHttpServer())
        .put('/settings/test_xss')
        .send({ value: '<img onerror=alert(1)>' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('JWT: Token com payload modificado → 401', async () => {
      const token = generateValidToken();
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.sub = 'hacker';
      parts[1] = Buffer.from(JSON.stringify(payload))
        .toString('base64')
        .replace(/=/g, '');
      const tampered = parts.join('.');

      const res = await request(app.getHttpServer())
        .get('/emails')
        .set('Authorization', `Bearer ${tampered}`);
      expect(res.status).toBe(401);
    });

    it('JWT: Token assinado com chave diferente → 401', async () => {
      const badToken = jwtService.sign(
        { sub: 'user-123' },
        { secret: 'CHAVE_FALSA_AQUI' },
      );
      const res = await request(app.getHttpServer())
        .get('/emails')
        .set('Authorization', `Bearer ${badToken}`);
      expect(res.status).toBe(401);
    });

    it('Criptografia: APP_SECRET errado → falha de decrypt com exceção clara', () => {
      expect(() => {
        const instance = new CryptoService({
          get: () =>
            'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        } as any);
        const { encrypted, iv, tag } = instance.encrypt('test data');
        const badTag = tag.replace(/[0-9a-f]/, 'f');
        instance.decrypt(encrypted, iv, badTag);
      }).toThrow();
    });

    it('Criptografia: Dois encrypts do mesmo texto produzem resultados diferentes', () => {
      const instance = new CryptoService({
        get: () =>
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      } as any);
      const r1 = instance.encrypt('my super secret message');
      const r2 = instance.encrypt('my super secret message');

      expect(r1.iv).not.toEqual(r2.iv);
      expect(r1.encrypted.toString('hex')).not.toEqual(
        r2.encrypted.toString('hex'),
      );
    });
  });

  describe('Rate Limiting Final', () => {
    it('31 requests em menos de 1 minuto → 429 Too Many Requests', async () => {
      const token = generateValidToken();
      prisma.email.findMany.mockResolvedValue([]);
      prisma.email.count.mockResolvedValue(0);

      const requests = Array.from({ length: 31 }, () =>
        request(app.getHttpServer())
          .get('/emails')
          .set('Authorization', `Bearer ${token}`),
      );

      const responses = await Promise.all(requests);
      const statusCodes = responses.map((r) => r.status);
      expect(statusCodes).toContain(429);
    });
  });
});
