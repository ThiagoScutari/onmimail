import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OAuthService } from './oauth.service';
import { OAuthCallbackDto, OAuthDisconnectDto } from './dto/oauth-callback.dto';

@Controller('oauth')
@UseGuards(JwtAuthGuard)
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get('authorize')
  async authorize(
    @Query('provider') provider?: string,
  ): Promise<{ url: string }> {
    const url = await this.oauthService.getAuthorizationUrl(
      provider || 'microsoft',
    );
    return { url };
  }

  @Post('callback')
  async callback(
    @Body() dto: OAuthCallbackDto,
  ): Promise<{ connected: boolean }> {
    await this.oauthService.exchangeCodeForTokens(
      dto.code,
      dto.provider || 'microsoft',
    );
    return { connected: true };
  }

  @Get('status')
  async status(
    @Query('provider') provider?: string,
  ): Promise<{ connected: boolean; provider: string }> {
    const connected = await this.oauthService.isConnected(
      provider || 'microsoft',
    );
    return { connected, provider: provider || 'microsoft' };
  }

  @Post('disconnect')
  async disconnect(
    @Body() dto: OAuthDisconnectDto,
  ): Promise<{ disconnected: boolean }> {
    await this.oauthService.disconnect(dto.provider || 'microsoft');
    return { disconnected: true };
  }
}
