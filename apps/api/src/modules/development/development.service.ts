import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { UpsertDevelopmentAssessmentDto } from "./dto/upsert-development-assessment.dto";

@Injectable()
export class DevelopmentService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(scope: TenantScope, dto: UpsertDevelopmentAssessmentDto) {
    const branchId = requireOperationalScope(scope);
    const child = await this.prisma.child.findFirst({ where: { id: dto.childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (child.branchId !== branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }

    return this.prisma.developmentAssessment.upsert({
      where: { childId_period: { childId: dto.childId, period: dto.period } },
      create: {
        organizationId: scope.organizationId,
        branchId,
        childId: dto.childId,
        period: dto.period,
        speechRating: dto.speechRating,
        motorRating: dto.motorRating,
        socialRating: dto.socialRating,
        cognitiveRating: dto.cognitiveRating,
        note: dto.note,
      },
      update: {
        speechRating: dto.speechRating,
        motorRating: dto.motorRating,
        socialRating: dto.socialRating,
        cognitiveRating: dto.cognitiveRating,
        note: dto.note,
      },
    });
  }

  async findByChild(scope: TenantScope, childId: string) {
    const child = await this.prisma.child.findFirst({ where: { id: childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (scope.branchId && child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    return this.prisma.developmentAssessment.findMany({
      where: { childId },
      orderBy: { period: "desc" },
    });
  }
}
