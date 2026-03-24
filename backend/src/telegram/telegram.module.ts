import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../crypto/crypto.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [PrismaModule, CryptoModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
