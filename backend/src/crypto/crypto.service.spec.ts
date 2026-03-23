import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

// 32 bytes hex key for testing
const TEST_APP_SECRET =
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'APP_SECRET') return TEST_APP_SECRET;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it('encrypt retorna Buffer não-vazio + IV + Tag', () => {
    const result = service.encrypt('teste');

    expect(result.encrypted).toBeInstanceOf(Buffer);
    expect(result.encrypted.length).toBeGreaterThan(0);
    expect(result.iv).toBeDefined();
    expect(typeof result.iv).toBe('string');
    expect(result.iv.length).toBe(24); // 12 bytes hex
    expect(result.tag).toBeDefined();
    expect(typeof result.tag).toBe('string');
    expect(result.tag.length).toBe(32); // 16 bytes hex
  });

  it('decrypt com os mesmos IV/Tag retorna o plaintext original', () => {
    const plaintext = 'Dados contábeis sensíveis - DARF vencimento 28/03';
    const { encrypted, iv, tag } = service.encrypt(plaintext);

    const decrypted = service.decrypt(encrypted, iv, tag);

    expect(decrypted).toBe(plaintext);
  });

  it('decrypt com IV errado lança exceção', () => {
    const { encrypted, tag } = service.encrypt('teste');
    const wrongIv = 'aabbccddeeff00112233445566'; // 12 bytes hex falso

    expect(() => service.decrypt(encrypted, wrongIv, tag)).toThrow();
  });

  it('decrypt com Tag errado lança exceção', () => {
    const { encrypted, iv } = service.encrypt('teste');
    const wrongTag = 'aabbccddeeff00112233445566778899'; // 16 bytes hex falso

    expect(() => service.decrypt(encrypted, iv, wrongTag)).toThrow();
  });

  it('encrypt de strings vazias funciona corretamente', () => {
    const { encrypted, iv, tag } = service.encrypt('');

    expect(encrypted).toBeInstanceOf(Buffer);
    expect(iv).toBeDefined();
    expect(tag).toBeDefined();

    const decrypted = service.decrypt(encrypted, iv, tag);
    expect(decrypted).toBe('');
  });

  it('dois encrypts do mesmo texto geram resultados diferentes (IV aleatório)', () => {
    const plaintext = 'mesmo texto';
    const result1 = service.encrypt(plaintext);
    const result2 = service.encrypt(plaintext);

    expect(result1.iv).not.toBe(result2.iv);
    expect(result1.encrypted.toString('hex')).not.toBe(
      result2.encrypted.toString('hex'),
    );
  });
});
