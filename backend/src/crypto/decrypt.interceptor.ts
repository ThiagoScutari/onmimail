/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CryptoService } from './crypto.service';

// Prisma retorna dados dinâmicos — tipagem estrita inviável neste interceptor
type AnyRecord = Record<string, any>;

const ENCRYPTED_FIELDS = ['from', 'to', 'subject', 'body'] as const;

@Injectable()
export class DecryptInterceptor implements NestInterceptor {
  constructor(private readonly cryptoService: CryptoService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.decryptResponse(data)));
  }

  private decryptResponse(data: any): any {
    if (data?.data && Array.isArray(data.data)) {
      return {
        ...data,
        data: data.data.map((item: AnyRecord) => this.decryptEmail(item)),
      };
    }

    if (data?.from_enc) {
      return this.decryptEmail(data);
    }

    return data;
  }

  private decryptEmail(email: AnyRecord): AnyRecord {
    const result: AnyRecord = { ...email };

    for (const field of ENCRYPTED_FIELDS) {
      const encKey = `${field}_enc`;
      const ivKey = `${field}_iv`;
      const tagKey = `${field}_tag`;

      if (result[encKey]) {
        try {
          result[field] = this.cryptoService.decrypt(
            Buffer.from(result[encKey]),
            result[ivKey],
            result[tagKey],
          );
        } catch {
          result[field] = '[ERRO DE DESCRIPTOGRAFIA]';
        }

        delete result[encKey];
        delete result[ivKey];
        delete result[tagKey];
      }
    }

    return result;
  }
}
