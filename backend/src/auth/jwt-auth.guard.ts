import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    err: Error | null,
    user: TUser | false,
    info: { message?: string } | undefined,
    context: ExecutionContext,
  ): TUser {
    void context;

    if (err) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    if (!user) {
      const message = info?.message;
      if (message === 'No auth token') {
        throw new UnauthorizedException('Token não fornecido');
      }
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    return user;
  }
}
