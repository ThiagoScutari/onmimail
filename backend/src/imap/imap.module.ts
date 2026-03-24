import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../crypto/crypto.module';
import { OAuthModule } from '../oauth/oauth.module';
import { ImapService } from './imap.service';

@Module({
  imports: [PrismaModule, CryptoModule, OAuthModule],
  providers: [ImapService],
  exports: [ImapService],
})
export class ImapModule {}
