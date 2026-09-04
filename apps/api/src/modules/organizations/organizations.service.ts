import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { OrganizationQueryDto } from "./dto/organization-query.dto";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { slugify } from "./slugify";

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto) {
    const slug = await this.generateUniqueSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
          contactName: dto.contactName,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
        },
      });

      await tx.branch.create({
        data: {
          organizationId: organization.id,
          name: dto.firstBranchName?.trim() || "Bosh filial",
        },
      });

      await tx.wallet.create({
        data: { organizationId: organization.id, balance: 0 },
      });

      if (dto.planId) {
        const plan = await tx.plan.findUnique({ where: { id: dto.planId } });
        if (plan) {
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          await tx.subscription.create({
            data: {
              organizationId: organization.id,
              planId: plan.id,
              status: "ACTIVE",
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
            },
          });
        }
      }

      return tx.organization.findUniqueOrThrow({
        where: { id: organization.id },
        include: organizationInclude,
      });
    });
  }

  async findAll(query: OrganizationQueryDto) {
    const where: Prisma.OrganizationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" as Prisma.QueryMode } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        include: organizationInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data: items,
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: organizationInclude,
    });
    if (!organization) {
      throw new NotFoundException("Tashkilot topilmadi");
    }
    return organization;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findOne(id);
    return this.prisma.organization.update({
      where: { id },
      data: dto,
      include: organizationInclude,
    });
  }

  async addBranch(organizationId: string, dto: CreateBranchDto) {
    await this.findOne(organizationId);
    try {
      return await this.prisma.branch.create({
        data: { organizationId, name: dto.name, address: dto.address },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu nom bilan filial allaqachon mavjud");
      }
      throw err;
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.prisma.organization.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
  }
}

const organizationInclude = {
  branches: { orderBy: { createdAt: "asc" as const } },
  subscription: { include: { plan: true } },
  wallet: true,
} satisfies Prisma.OrganizationInclude;
