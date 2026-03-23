import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { DecryptInterceptor } from './decrypt.interceptor';

@Global()
@Module({
  providers: [CryptoService, DecryptInterceptor],
  exports: [CryptoService, DecryptInterceptor],
})
export class CryptoModule {}
