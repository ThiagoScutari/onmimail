import { Test, TestingModule } from '@nestjs/testing';
import { EmailsController } from './emails.controller';
import { EmailsService } from './emails.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DecryptInterceptor } from '../crypto/decrypt.interceptor';
import { EmailStatus } from '@prisma/client';
import {
  NotFoundException,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { UpdateStatusDto } from './dto/update-status.dto';

describe('EmailsController', () => {
  let controller: EmailsController;

  const mockEmailsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockJwtAuthGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailsController],
      providers: [{ provide: EmailsService, useValue: mockEmailsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideInterceptor(DecryptInterceptor)
      .useValue({
        intercept: jest.fn((context: ExecutionContext, next: CallHandler) =>
          next.handle(),
        ),
      })
      .compile();

    controller = module.get<EmailsController>(EmailsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GET /emails returns paginated list', async () => {
    const resultMock = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    };
    mockEmailsService.findAll.mockResolvedValueOnce(resultMock);

    const result = await controller.findAll({ page: 1, limit: 20 });
    expect(result.data).toEqual([]);
    expect(result.meta.page).toBe(1);
  });

  it('GET /emails?status=UNREAD filters correctly', async () => {
    const query = { status: EmailStatus.UNREAD };
    mockEmailsService.findAll.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    await controller.findAll(query);
    expect(mockEmailsService.findAll).toHaveBeenCalledWith(query);
  });

  it('GET /emails/:id returns email', async () => {
    const mockEmail = { id: 'uuid-1', status: EmailStatus.READ };
    mockEmailsService.findOne.mockResolvedValueOnce(mockEmail);
    const result = await controller.findOne('uuid-1');
    expect(result).toEqual(mockEmail);
  });

  it('GET /emails/:id with invalid id throws NotFoundException', async () => {
    mockEmailsService.findOne.mockRejectedValueOnce(new NotFoundException());
    await expect(controller.findOne('invalid-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('PATCH /emails/:id/status updates status', async () => {
    const date = new Date();
    mockEmailsService.updateStatus.mockResolvedValueOnce({
      id: 'uuid-1',
      status: EmailStatus.READ,
      updatedAt: date,
    });

    const result = await controller.updateStatus('uuid-1', {
      status: EmailStatus.READ,
    });
    expect(result.status).toBe(EmailStatus.READ);
    expect(result.updatedAt).toBe(date.toISOString());
  });

  it('UpdateStatusDto validation fails on invalid status', async () => {
    const dto = new UpdateStatusDto();
    dto.status = 'INVALID_STATUS' as unknown as EmailStatus;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
