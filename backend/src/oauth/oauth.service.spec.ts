import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from './oauth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';

// Mock @azure/msal-node entirely
const mockGetAuthCodeUrl = jest.fn();
const mockAcquireTokenByCode = jest.fn();
const mockAcquireTokenSilent = jest.fn();
const mockSerialize = jest.fn().mockReturnValue('{"serialized":"cache"}');
const mockDeserialize = jest.fn();
const mockGetAllAccounts = jest.fn();

jest.mock('@azure/msal-node', () => ({
  ConfidentialClientApplication: jest.fn().mockImplementation(() => ({
    getAuthCodeUrl: mockGetAuthCodeUrl,
    acquireTokenByCode: mockAcquireTokenByCode,
    acquireTokenSilent: mockAcquireTokenSilent,
    getTokenCache: jest.fn().mockReturnValue({
      serialize: mockSerialize,
      deserialize: mockDeserialize,
      getAllAccounts: mockGetAllAccounts,
    }),
  })),
}));

describe('OAuthService', () => {
  let service: OAuthService;

  const mockPrisma = {
    setting: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockCryptoService = {
    decrypt: jest.fn(),
    encrypt: jest.fn().mockReturnValue({
      encrypted: Buffer.from('encrypted'),
      iv: 'mock-iv',
      tag: 'mock-tag',
    }),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:5173'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCryptoService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
  });

  describe('buildXOAuth2Token', () => {
    it('should produce correct base64 XOAUTH2 token', () => {
      const email = 'user@example.com';
      const accessToken = 'test-access-token';

      const result = service.buildXOAuth2Token(email, accessToken);

      const expected = Buffer.from(
        `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`,
      ).toString('base64');

      expect(result).toBe(expected);

      // Verify the decoded content is correct
      const decoded = Buffer.from(result, 'base64').toString();
      expect(decoded).toBe(
        `user=user@example.com\x01auth=Bearer test-access-token\x01\x01`,
      );
    });
  });

  describe('isConnected', () => {
    it('should return false when no refresh token exists', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue(null);

      const result = await service.isConnected();

      expect(result).toBe(false);
    });

    it('should return true when refresh token exists', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue({
        key: 'oauth_refresh_token',
        value_enc: Buffer.from('encrypted'),
        iv: 'test-iv',
        tag: 'test-tag',
      });
      mockCryptoService.decrypt.mockReturnValue('some-cached-tokens');

      const result = await service.isConnected();

      expect(result).toBe(true);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should build authorization URL via MSAL', async () => {
      // Mock the settings for oauth credentials
      mockPrisma.setting.findUnique.mockImplementation(
        ({ where }: { where: { key: string } }) => {
          const settings: Record<string, any> = {
            oauth_client_id: {
              key: 'oauth_client_id',
              value_enc: Buffer.from('enc'),
              iv: 'iv',
              tag: 'tag',
            },
            oauth_tenant_id: {
              key: 'oauth_tenant_id',
              value_enc: Buffer.from('enc'),
              iv: 'iv',
              tag: 'tag',
            },
            oauth_client_secret: {
              key: 'oauth_client_secret',
              value_enc: Buffer.from('enc'),
              iv: 'iv',
              tag: 'tag',
            },
          };
          return Promise.resolve(settings[where.key] || null);
        },
      );
      mockCryptoService.decrypt.mockImplementation(() => {
        return 'decrypted-value';
      });

      const expectedUrl =
        'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?client_id=...';
      mockGetAuthCodeUrl.mockResolvedValue(expectedUrl);

      const result = await service.getAuthorizationUrl();

      expect(result).toBe(expectedUrl);
      expect(mockGetAuthCodeUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: [
            'https://outlook.office.com/IMAP.AccessAsUser.All',
            'offline_access',
          ],
          redirectUri: 'http://localhost:5173/settings/oauth/callback',
        }),
      );
    });
  });

  describe('disconnect', () => {
    it('should remove oauth settings from database', async () => {
      mockPrisma.setting.deleteMany.mockResolvedValue({ count: 2 });

      await service.disconnect();

      expect(mockPrisma.setting.deleteMany).toHaveBeenCalledWith({
        where: {
          key: { in: ['oauth_refresh_token', 'oauth_provider'] },
        },
      });
    });
  });
});
