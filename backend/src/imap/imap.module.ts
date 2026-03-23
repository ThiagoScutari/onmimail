import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ImapService } from './imap.service';

@Module({
  imports: [ConfigModule],
  providers: [ImapService],
  exports: [ImapService],
})
export class ImapModule {}
