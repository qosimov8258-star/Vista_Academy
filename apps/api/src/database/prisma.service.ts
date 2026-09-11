import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Rasm blob'lari hech qachon oddiy so'rovga tushmasin: Prisma sukut
    // bo'yicha barcha skalyar maydonlarni qaytaradi, ya'ni `avatar` ustuni
    // har bir filial va foydalanuvchi javobiga base64 bo'lib qo'shilib
    // ketardi. Rasm kerak bo'lgan yagona joy — uni alohida `select` bilan
    // so'raydi (select global `omit` dan ustun turadi).
    super({
      omit: {
        branch: { avatar: true },
        tenantUser: { avatar: true },
        child: { avatar: true },
        employee: { avatar: true },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Connected to PostgreSQL via Prisma");
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
