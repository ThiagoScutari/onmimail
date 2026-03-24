import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as msal from '@azure/msal-node';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
  ) {}

  private async getSettingValue(key: string): Promise<string | null> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) return null;
    const value = this.cryptoService.decrypt(
      Buffer.from(setting.value_enc),
      setting.iv,
      setting.tag,
    );
    return value && value.trim() !== '' ? value : null;
  }

  private async createMsalClient(): Promise<msal.ConfidentialClientApplication> {
    const clientId = await this.getSettingValue('oauth_client_id');
    const tenantId = await this.getSettingValue('oauth_tenant_id');
    const clientSecret = await this.getSettingValue('oauth_client_secret');

    if (!clientId || !tenantId || !clientSecret) {
      throw new Error('OAuth client credentials not configured in settings');
    }

    // Use 'common' authority to support both personal and organizational accounts
    const msalConfig: msal.Configuration = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/common`,
        clientSecret,
      },
    };

    return new msal.ConfidentialClientApplication(msalConfig);
  }

  async getAuthorizationUrl(/* provider?: string */): Promise<string> {
    const client = await this.createMsalClient();
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const redirectUri = `${frontendUrl}/settings/oauth/callback`;

    const authCodeUrlParameters: msal.AuthorizationUrlRequest = {
      scopes: [
        'https://outlook.office.com/IMAP.AccessAsUser.All',
        'offline_access',
      ],
      redirectUri,
    };

    const url = await client.getAuthCodeUrl(authCodeUrlParameters);
    return url;
  }

  async exchangeCodeForTokens(code: string): Promise<void> {
    const provider = 'microsoft';
    const client = await this.createMsalClient();
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const redirectUri = `${frontendUrl}/settings/oauth/callback`;

    const tokenRequest: msal.AuthorizationCodeRequest = {
      code,
      scopes: [
        'https://outlook.office.com/IMAP.AccessAsUser.All',
        'offline_access',
      ],
      redirectUri,
    };

    let response: msal.AuthenticationResult | null;
    try {
      response = await client.acquireTokenByCode(tokenRequest);
    } catch (err) {
      this.logger.error(
        'Token exchange failed',
        err instanceof Error ? err.message : err,
      );
      throw err;
    }

    if (!response) {
      throw new Error('Failed to acquire tokens from authorization code');
    }

    // MSAL v2 doesn't directly expose refresh_token in the response,
    // but it caches it internally. We store what we can for token refresh.
    // For MSAL node, the token cache contains the refresh token.
    const cache = client.getTokenCache().serialize();

    // Store the serialized token cache as our "refresh token" equivalent
    const encrypted = this.cryptoService.encrypt(cache);
    await this.prisma.setting.upsert({
      where: { key: 'oauth_refresh_token' },
      update: {
        value_enc: new Uint8Array(encrypted.encrypted),
        iv: encrypted.iv,
        tag: encrypted.tag,
      },
      create: {
        key: 'oauth_refresh_token',
        value_enc: new Uint8Array(encrypted.encrypted),
        iv: encrypted.iv,
        tag: encrypted.tag,
      },
    });

    // Store the provider
    const providerEncrypted = this.cryptoService.encrypt(provider);
    await this.prisma.setting.upsert({
      where: { key: 'oauth_provider' },
      update: {
        value_enc: new Uint8Array(providerEncrypted.encrypted),
        iv: providerEncrypted.iv,
        tag: providerEncrypted.tag,
      },
      create: {
        key: 'oauth_provider',
        value_enc: new Uint8Array(providerEncrypted.encrypted),
        iv: providerEncrypted.iv,
        tag: providerEncrypted.tag,
      },
    });
  }

  async getAccessToken(/* provider?: string */): Promise<string> {
    const cachedTokens = await this.getSettingValue('oauth_refresh_token');
    if (!cachedTokens) {
      throw new Error('No OAuth tokens found. Please connect OAuth first.');
    }

    const client = await this.createMsalClient();

    // Deserialize the cached tokens back into the MSAL client
    client.getTokenCache().deserialize(cachedTokens);

    // Get accounts from cache to use for silent acquisition
    const accounts = await client.getTokenCache().getAllAccounts();

    if (accounts.length === 0) {
      throw new Error('No cached accounts found. Please reconnect OAuth.');
    }

    const silentRequest: msal.SilentFlowRequest = {
      account: accounts[0],
      scopes: ['https://outlook.office.com/IMAP.AccessAsUser.All'],
    };

    try {
      const response = await client.acquireTokenSilent(silentRequest);
      if (!response || !response.accessToken) {
        throw new Error('Failed to acquire access token silently');
      }

      // Update the cached tokens with any refreshed values
      const updatedCache = client.getTokenCache().serialize();
      const encrypted = this.cryptoService.encrypt(updatedCache);
      await this.prisma.setting.upsert({
        where: { key: 'oauth_refresh_token' },
        update: {
          value_enc: new Uint8Array(encrypted.encrypted),
          iv: encrypted.iv,
          tag: encrypted.tag,
        },
        create: {
          key: 'oauth_refresh_token',
          value_enc: new Uint8Array(encrypted.encrypted),
          iv: encrypted.iv,
          tag: encrypted.tag,
        },
      });

      return response.accessToken;
    } catch (error) {
      this.logger.error('Silent token acquisition failed', error);
      throw new Error(
        'Failed to refresh access token. Please reconnect OAuth.',
      );
    }
  }

  buildXOAuth2Token(email: string, accessToken: string): string {
    return Buffer.from(
      `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`,
    ).toString('base64');
  }

  async isConnected(/* provider?: string */): Promise<boolean> {
    const refreshToken = await this.getSettingValue('oauth_refresh_token');
    return refreshToken !== null;
  }

  async disconnect(/* provider?: string */): Promise<void> {
    await this.prisma.setting.deleteMany({
      where: {
        key: { in: ['oauth_refresh_token', 'oauth_provider'] },
      },
    });
  }
}
