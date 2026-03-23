import { Module } from '@nestjs/common';
import { ImapModule } from '../imap/imap.module';
import { TelegramModule } from '../telegram/telegram.module';
import { EmailProcessorService } from './email-processor.service';
import { EmailProcessorController } from './email-processor.controller';

@Module({
  imports: [ImapModule, TelegramModule],
  controllers: [EmailProcessorController],
  providers: [EmailProcessorService],
  exports: [EmailProcessorService],
})
export class EmailProcessorModule {}
