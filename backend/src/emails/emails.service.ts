import { Injectable, NotFoundException } from '@nestjs/common';
import { Email, EmailStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';

@Injectable()
export class EmailsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto): Promise<{
    data: Email[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.EmailWhereInput = {};

    if (query.status !== undefined) {
      where.status = query.status;
    }

    if (query.dateFrom !== undefined || query.dateTo !== undefined) {
      where.date = {};
      if (query.dateFrom !== undefined) {
        where.date.gte = new Date(query.dateFrom);
      }
      if (query.dateTo !== undefined) {
        where.date.lte = new Date(query.dateTo);
      }
    }

    const [total, data] = await Promise.all([
      this.prisma.email.count({ where }),
      this.prisma.email.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { date: 'desc' },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Email> {
    const email = await this.prisma.email.findUnique({
      where: { id },
    });
    if (!email) {
      throw new NotFoundException('Email not found');
    }
    return email;
  }

  async updateStatus(
    id: string,
    status: EmailStatus,
  ): Promise<{ id: string; status: EmailStatus; updatedAt: Date }> {
    await this.findOne(id);

    const updated = await this.prisma.email.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, updatedAt: true },
    });

    return {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  }
}
