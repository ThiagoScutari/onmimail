import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CryptoModule } from './crypto/crypto.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmailProcessorModule } from './email-processor/email-processor.module';
import { EmailsModule } from './emails/emails.module';
import { SettingsModule } from './settings/settings.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        APP_SECRET: Joi.string().hex().length(64).required(),
        MONITORED_SENDERS: Joi.string().default(''),
        FRONTEND_URL: Joi.string().default('http://localhost:5173'),
        TELEGRAM_BOT_TOKEN: Joi.string().optional().allow('').default(''),
        TELEGRAM_CHAT_ID: Joi.string().optional().allow('').default(''),
      }),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 30,
      },
    ]),
    PrismaModule,
    CryptoModule,
    AuthModule,
    EmailProcessorModule,
    EmailsModule,
    SettingsModule,
    TelegramModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
