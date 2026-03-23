import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing';

const mockUser = {
  id: 'user-uuid-123',
  email: 'test@example.com',
  passwordHash: '', // will be set in beforeAll
  createdAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('validPassword123', 10);
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: new JwtService({}) },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'JWT_SECRET') return TEST_JWT_SECRET;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('login com credenciais válidas retorna tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.login('test@example.com', 'validPassword123');

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.accessToken.split('.')).toHaveLength(3); // JWT format
    expect(result.refreshToken.split('.')).toHaveLength(3);
  });

  it('login com senha errada lança UnauthorizedException', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    await expect(
      service.login('test@example.com', 'wrongPassword'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('login com email inexistente lança UnauthorizedException', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login('nonexistent@example.com', 'anyPassword'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
