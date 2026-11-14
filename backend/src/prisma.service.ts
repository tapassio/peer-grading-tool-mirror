import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { sqliteAdapter } from './prisma-client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ adapter: sqliteAdapter() });
  }

  async onModuleInit() {
    await this.$connect();
  }

  // Prisma 5+ has no 'beforeExit' hook anymore; Nest closes the connection
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
