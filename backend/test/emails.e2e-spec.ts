/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { CryptoService } from '../src/crypto/crypto.service';
import { CryptoModule } from '../src/crypto/crypto.module';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { EmailsModule } from '../src/emails/emails.module';
import { EmailProcessorModule } from '../src/email-processor/email-processor.module';
import { ImapService } from '../src/imap/imap.service';

const TEST_JWT_SECRET = randomBytes(32).toString('hex');
const TEST_APP_SECRET = randomBytes(32).toString('hex');

describe('Emails E2E', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let cryptoService: CryptoService;
  let prisma: Record<string, any>;

  function generateToken(): string {
    return jwtService.sign(
      { sub: 'user-123', email: 'test@example.com' },
      { secret: TEST_JWT_SECRET, expiresIn: '15m' },
    );
  }

  function createEncryptedEmail(
    id: string,
    from: string,
    to: string,
    subject: string,
    body: string,
  ) {
    const fromEnc = cryptoService.encrypt(from);
    const toEnc = cryptoService.encrypt(to);
    const subjectEnc = cryptoService.encrypt(subject);
    const bodyEnc = cryptoService.encrypt(body);

    return {
      id,
      messageId: `msg-${id}`,
      from_enc: fromEnc.encrypted,
      from_iv: fromEnc.iv,
      from_tag: fromEnc.tag,
      to_enc: toEnc.encrypted,
      to_iv: toEnc.iv,
      to_tag: toEnc.tag,
      subject_enc: subjectEnc.encrypted,
      subject_iv: subjectEnc.iv,
      subject_tag: subjectEnc.tag,
      body_enc: bodyEnc.encrypted,
      body_iv: bodyEnc.iv,
      body_tag: bodyEnc.tag,
      date: new Date('2026-03-20'),
      status: 'UNREAD',
      hasAttachments: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  beforeAll(async () => {
    prisma = {
      email: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: Joi.object({
            DATABASE_URL: Joi.string().default(
              'postgresql://test:test@localhost:5432/test',
            ),
            JWT_SECRET: Joi.string().default(TEST_JWT_SECRET),
            APP_SECRET: Joi.string().default(TEST_APP_SECRET),
            MONITORED_SENDERS: Joi.string().default(
              'contabiletica@hotmail.com',
            ),
            FRONTEND_URL: Joi.string().default('http://localhost:5173'),
          }),
        }),
        PrismaModule,
        CryptoModule,
        AuthModule,
        EmailsModule,
        EmailProcessorModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ImapService)
      .useValue({
        fetchEmails: jest.fn().mockResolvedValue([]),
        markAsRead: jest.fn().mockResolvedValue(undefined),
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
    cryptoService = moduleFixture.get<CryptoService>(CryptoService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /emails', () => {
    it('retorna lista vazia quando não há emails', async () => {
      prisma.email.findMany.mockResolvedValue([]);
      prisma.email.count.mockResolvedValue(0);

      const token = generateToken();
      const res = await request(app.getHttpServer())
        .get('/emails')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('retorna emails descriptografados', async () => {
      const email = createEncryptedEmail(
        'email-1',
        'contabiletica@hotmail.com',
        'thiago@outlook.com',
        'DARF Vencimento 28/03',
        'Segue guia de pagamento.',
      );
      prisma.email.findMany.mockResolvedValue([email]);
      prisma.email.count.mockResolvedValue(1);

      const token = generateToken();
      const res = await request(app.getHttpServer())
        .get('/emails')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);

      const item = res.body.data[0];
      expect(item.from).toBe('contabiletica@hotmail.com');
      expect(item.to).toBe('thiago@outlook.com');
      expect(item.subject).toBe('DARF Vencimento 28/03');
      // Encrypted fields removed
      expect(item.from_enc).toBeUndefined();
      expect(item.to_enc).toBeUndefined();
      expect(item.subject_enc).toBeUndefined();
    });

    it('filtra por status', async () => {
      prisma.email.findMany.mockResolvedValue([]);
      prisma.email.count.mockResolvedValue(0);

      const token = generateToken();
      const res = await request(app.getHttpServer())
        .get('/emails?status=READ')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(prisma.email.findMany).toHaveBeenCalled();
    });
  });

  describe('GET /emails/:id', () => {
    it('retorna email com body descriptografado', async () => {
      const email = createEncryptedEmail(
        'detail-1',
        'contabiletica@hotmail.com',
        'thiago@outlook.com',
        'Guia FGTS',
        'Corpo completo do email com todos os detalhes.',
      );
      prisma.email.findUnique.mockResolvedValue(email);

      const token = generateToken();
      const res = await request(app.getHttpServer())
        .get('/emails/detail-1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.from).toBe('contabiletica@hotmail.com');
      expect(res.body.subject).toBe('Guia FGTS');
      expect(res.body.body).toBe(
        'Corpo completo do email com todos os detalhes.',
      );
      expect(res.body.body_enc).toBeUndefined();
    });

    it('retorna 404 para email inexistente', async () => {
      prisma.email.findUnique.mockResolvedValue(null);

      const token = generateToken();
      const res = await request(app.getHttpServer())
        .get('/emails/nonexistent-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /emails/:id/status', () => {
    it('atualiza status para READ', async () => {
      const email = createEncryptedEmail(
        'patch-1',
        'contabiletica@hotmail.com',
        'thiago@outlook.com',
        'Test',
        'Body',
      );
      prisma.email.findUnique.mockResolvedValue(email);
      prisma.email.update.mockResolvedValue({
        id: 'patch-1',
        status: 'READ',
        updatedAt: new Date('2026-03-23'),
      });

      const token = generateToken();
      const res = await request(app.getHttpServer())
        .patch('/emails/patch-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'READ' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('patch-1');
      expect(res.body.status).toBe('READ');
    });

    it('rejeita status inválido', async () => {
      const token = generateToken();
      const res = await request(app.getHttpServer())
        .patch('/emails/patch-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVALID' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /emails/sync', () => {
    it('executa sync e retorna contagem', async () => {
      const token = generateToken();
      const res = await request(app.getHttpServer())
        .post('/emails/sync')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('processed');
      expect(res.body).toHaveProperty('message');
      expect(typeof res.body.processed).toBe('number');
    });
  });
});
