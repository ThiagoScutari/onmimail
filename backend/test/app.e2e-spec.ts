/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'crypto';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_JWT_SECRET = randomBytes(32).toString('hex');
const TEST_APP_SECRET = randomBytes(32).toString('hex');

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
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
            MONITORED_SENDERS: Joi.string().optional().default(''),
            FRONTEND_URL: Joi.string()
              .optional()
              .default('http://localhost:5173'),
          }),
        }),
        PrismaModule,
      ],
      controllers: [AppController],
      providers: [AppService],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
