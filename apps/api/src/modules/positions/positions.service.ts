import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { CreatePositionDto } from "./dto/create-position.dto";

@Injectable()
export class PositionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(scope: TenantScope) {
    return this.prisma.position.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(scope: TenantScope, dto: CreatePositionDto) {
    requireOperationalScope(scope);
    try {
      return await this.prisma.position.create({
        data: { organizationId: scope.organizationId, name: dto.name.trim() },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu lavozim allaqachon mavjud");
      }
      throw err;
    }
  }
}
