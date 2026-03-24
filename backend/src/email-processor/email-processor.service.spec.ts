/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailProcessorService } from './email-processor.service';
import { ImapService } from '../imap/imap.service';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { ParsedEmail } from '../imap/parsed-email.interface';

const TEST_APP_SECRET =
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

const makeParsedEmail = (overrides?: Partial<ParsedEmail>): ParsedEmail => ({
  messageId: `msg-${Date.now()}-${Math.random()}`,
  from: 'contabiletica@hotmail.com',
  to: 'thiago.scutari@outlook.com',
  subject: 'DARF - Vencimento 28/03',
  body: 'Segue guia de pagamento em anexo.',
  date: new Date('2026-03-20'),
  hasAttachments: true,
  ...overrides,
});

describe('EmailProcessorService', () => {
  let service: EmailProcessorService;
  let cryptoService: CryptoService;
  let mockImapService: { fetchEmails: jest.Mock; markAsRead: jest.Mock };
  let mockPrisma: {
    email: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    setting: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockImapService = {
      fetchEmails: jest.fn().mockResolvedValue([]),
      markAsRead: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      email: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'test-id' }),
      },
      setting: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessorService,
        CryptoService,
        { provide: ImapService, useValue: mockImapService },
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: TelegramService,
          useValue: {
            isConfigured: jest.fn().mockResolvedValue(false),
            sendEmailAlert: jest.fn().mockResolvedValue(undefined),
            sendStatusMessage: jest.fn().mockResolvedValue(undefined),
          },
        },
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

    service = module.get<EmailProcessorService>(EmailProcessorService);
    cryptoService = module.get<CryptoService>(CryptoService);

    // Set up the setting mock to return encrypted monitored_senders
    const encSenders = cryptoService.encrypt('contabiletica@hotmail.com');
    mockPrisma.setting.findUnique.mockImplementation(
      ({ where }: { where: { key: string } }) => {
        if (where.key === 'monitored_senders') {
          return Promise.resolve({
            value_enc: encSenders.encrypted,
            iv: encSenders.iv,
            tag: encSenders.tag,
          });
        }
        return Promise.resolve(null);
      },
    );
  });

  it('processNewEmails com 3 e-mails cria 3 registros no BD', async () => {
    const emails = [
      makeParsedEmail({ messageId: 'msg-1' }),
      makeParsedEmail({ messageId: 'msg-2' }),
      makeParsedEmail({ messageId: 'msg-3' }),
    ];
    mockImapService.fetchEmails.mockResolvedValue(emails);

    const count = await service.processNewEmails(new Date(), [
      'sender@test.com',
    ]);

    expect(count).toBe(3);
    expect(mockPrisma.email.create).toHaveBeenCalledTimes(3);
  });

  it('e-mail duplicado (mesmo messageId) não cria novo registro', async () => {
    const email = makeParsedEmail({ messageId: 'duplicate-msg' });
    mockImapService.fetchEmails.mockResolvedValue([email]);
    mockPrisma.email.findUnique.mockResolvedValue({ id: 'existing-id' });

    const count = await service.processNewEmails(new Date(), [
      'sender@test.com',
    ]);

    expect(count).toBe(0);
    expect(mockPrisma.email.create).not.toHaveBeenCalled();
  });

  it('campos salvos no BD estão criptografados (não legíveis como texto)', async () => {
    const email = makeParsedEmail({
      messageId: 'enc-test',
      from: 'contabiletica@hotmail.com',
      subject: 'DARF - Vencimento 28/03',
    });
    mockImapService.fetchEmails.mockResolvedValue([email]);

    await service.processNewEmails(new Date(), ['sender@test.com']);

    const createCall = mockPrisma.email.create.mock.calls[0][0].data;

    // Campos criptografados são Uint8Array, não string legível
    expect(createCall.from_enc).toBeInstanceOf(Uint8Array);
    expect(createCall.subject_enc).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(createCall.from_enc).toString('utf8')).not.toBe(
      email.from,
    );
    expect(Buffer.from(createCall.subject_enc).toString('utf8')).not.toBe(
      email.subject,
    );
  });

  it('decrypt dos campos salvos retorna os valores originais', async () => {
    const email = makeParsedEmail({
      messageId: 'decrypt-test',
      from: 'contabiletica@hotmail.com',
      to: 'thiago@outlook.com',
      subject: 'Guia FGTS',
      body: 'Pagamento pendente',
    });
    mockImapService.fetchEmails.mockResolvedValue([email]);

    await service.processNewEmails(new Date(), ['sender@test.com']);

    const createCall = mockPrisma.email.create.mock.calls[0][0].data;

    // Decrypt cada campo e verifica roundtrip (Uint8Array → Buffer para decrypt)
    expect(
      cryptoService.decrypt(
        Buffer.from(createCall.from_enc),
        createCall.from_iv,
        createCall.from_tag,
      ),
    ).toBe(email.from);
    expect(
      cryptoService.decrypt(
        Buffer.from(createCall.to_enc),
        createCall.to_iv,
        createCall.to_tag,
      ),
    ).toBe(email.to);
    expect(
      cryptoService.decrypt(
        Buffer.from(createCall.subject_enc),
        createCall.subject_iv,
        createCall.subject_tag,
      ),
    ).toBe(email.subject);
    expect(
      cryptoService.decrypt(
        Buffer.from(createCall.body_enc),
        createCall.body_iv,
        createCall.body_tag,
      ),
    ).toBe(email.body);
  });

  it('cada campo sensível tem IV/Tag próprio (IVs diferentes)', async () => {
    const email = makeParsedEmail({ messageId: 'unique-iv-test' });
    mockImapService.fetchEmails.mockResolvedValue([email]);

    await service.processNewEmails(new Date(), ['sender@test.com']);

    const createCall = mockPrisma.email.create.mock.calls[0][0].data;

    // Todos os IVs devem ser diferentes entre si
    const ivs = [
      createCall.from_iv,
      createCall.to_iv,
      createCall.subject_iv,
      createCall.body_iv,
    ];
    const uniqueIvs = new Set(ivs);
    expect(uniqueIvs.size).toBe(4);
  });

  it('cronjob handleCron é executável manualmente', async () => {
    mockImapService.fetchEmails.mockResolvedValue([]);

    await expect(service.handleCron()).resolves.not.toThrow();
    expect(mockImapService.fetchEmails).toHaveBeenCalled();
  });

  it('processNewEmails com lista vazia retorna 0', async () => {
    mockImapService.fetchEmails.mockResolvedValue([]);

    const count = await service.processNewEmails(new Date(), [
      'sender@test.com',
    ]);

    expect(count).toBe(0);
    expect(mockPrisma.email.create).not.toHaveBeenCalled();
  });
});
