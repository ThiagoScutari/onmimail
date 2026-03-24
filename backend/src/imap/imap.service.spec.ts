/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-require-imports, @typescript-eslint/no-implied-eval */
import { Test, TestingModule } from '@nestjs/testing';
import { ImapService } from './imap.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { OAuthService } from '../oauth/oauth.service';

// Mock dependencies
jest.mock('imap', () => {
  return jest.fn().mockImplementation(() => {
    return {
      once: jest.fn((event, cb) => {
        if (event === 'ready') setTimeout(cb, 10);
      }),
      connect: jest.fn(),
      openBox: jest.fn((boxName, readOnly, cb) => cb(null, {})),
      search: jest.fn((criteria, cb) => cb(null, [1])),
      fetch: jest.fn(() => {
        const fetchObj = {
          on: jest.fn((event, cb) => {
            if (event === 'message') {
              const msgObj = {
                on: jest.fn((msgEvent, msgCb) => {
                  if (msgEvent === 'attributes') {
                    msgCb({ uid: 12345 });
                  }
                  if (msgEvent === 'body') {
                    msgCb({});
                  }
                }),
              };
              cb(msgObj);
            }
          }),
          once: jest.fn((event, cb) => {
            if (event === 'end') {
              setTimeout(cb, 20);
            }
          }),
        };
        return fetchObj;
      }),
      end: jest.fn(),
      addFlags: jest.fn((uid, flags, cb) => cb(null)),
    };
  });
});

jest.mock('mailparser', () => ({
  simpleParser: jest.fn(() => {
    return Promise.resolve({
      messageId: 'mock-id',
      from: { text: 'contabiletica@hotmail.com' },
      to: { text: 'me@me.com' },
      subject: 'Mock Subject',
      text: 'Mock body',
      html: false,
      date: new Date('2026-01-01'),
      attachments: [],
    });
  }),
}));

const mockSettingValues: Record<string, string> = {
  imap_host: 'mockHost',
  imap_port: '993',
  imap_user: 'mockUser',
  imap_password: 'mockPassword',
  imap_tls: 'true',
};

describe('ImapService', () => {
  let service: ImapService;

  beforeEach(async () => {
    const mockPrisma = {
      setting: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { key: string } }) => {
            const val = mockSettingValues[where.key];
            if (!val) return Promise.resolve(null);
            return Promise.resolve({
              value_enc: Buffer.from(val),
              iv: 'mock-iv',
              tag: 'mock-tag',
            });
          }),
      },
    };

    const mockCryptoService = {
      decrypt: jest
        .fn()
        .mockImplementation((enc: Buffer) => enc.toString('utf8')),
    };

    const mockOAuthService = {
      isConnected: jest.fn().mockResolvedValue(false),
      getAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
      buildXOAuth2Token: jest.fn().mockReturnValue('mock-xoauth2-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImapService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCryptoService },
        { provide: OAuthService, useValue: mockOAuthService },
      ],
    }).compile();

    service = module.get<ImapService>(ImapService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('fetchEmails returns parsed emails for matched sender', async () => {
    const emails = await service.fetchEmails(new Date(), [
      'contabileTICA@hotmail.com',
    ]);
    expect(emails.length).toBe(1);
    expect(emails[0].from).toBe('contabiletica@hotmail.com');
  });

  it('mail without plain text body falls back to parsed HTML', async () => {
    const mailparser = require('mailparser');
    mailparser.simpleParser.mockImplementationOnce(() =>
      Promise.resolve({
        from: { text: 'contabiletica@hotmail.com' },
        text: '',
        html: '<p>Hello <b>World</b></p>',
      }),
    );
    const emails = await service.fetchEmails(new Date(), [
      'contabiletica@hotmail.com',
    ]);
    expect(emails[0].body).toBe('Hello World');
  });

  it('fetchEmails filters out unmatched senders', async () => {
    const mailparser = require('mailparser');
    mailparser.simpleParser.mockImplementationOnce(() =>
      Promise.resolve({
        from: { text: 'random@email.com' },
      }),
    );
    const emails = await service.fetchEmails(new Date(), [
      'contabiletica@hotmail.com',
    ]);
    expect(emails.length).toBe(0);
  });

  it('timeout generates correctly and retries', async () => {
    const Imap = require('imap');
    Imap.mockImplementationOnce(() => ({
      once: jest.fn((event, cb) => {
        if (event === 'error')
          setTimeout(() => cb(new Error('Connection timeout')), 10);
      }),
      connect: jest.fn(),
      end: jest.fn(),
      getConfig: jest.fn(),
    }));

    const emails = await service.fetchEmails(new Date(), [
      'contabiletica@hotmail.com',
    ]);
    expect(emails.length).toBe(1);
  });
});
