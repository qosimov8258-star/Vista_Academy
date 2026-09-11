import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { CreateSubjectDto } from "./dto/create-subject.dto";

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(scope: TenantScope) {
    return this.prisma.subject.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(scope: TenantScope, dto: CreateSubjectDto) {
    requireOperationalScope(scope);
    try {
      return await this.prisma.subject.create({
        data: { organizationId: scope.organizationId, name: dto.name.trim() },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu fan allaqachon mavjud");
      }
      throw err;
    }
  }
}
