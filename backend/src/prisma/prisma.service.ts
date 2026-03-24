import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    try {
      const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const adapter = new PrismaPg(pool as any);
      super({ adapter });
    } catch {
      super();
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
