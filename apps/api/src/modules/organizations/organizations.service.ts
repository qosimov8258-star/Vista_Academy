import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../database/prisma.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { OrganizationQueryDto } from "./dto/organization-query.dto";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
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

      const firstBranchName = dto.firstBranchName?.trim() || "Bosh filial";
      await tx.branch.create({
        data: {
          organizationId: organization.id,
          name: firstBranchName,
          slug: await this.generateUniqueBranchSlug(organization.id, firstBranchName, tx),
        },
      });

      await tx.wallet.create({
        data: { organizationId: organization.id, balance: 0 },
      });

      const adminPasswordHash = await argon2.hash(dto.adminPassword);
      await tx.tenantUser.create({
        data: {
          organizationId: organization.id,
          email: dto.adminEmail.toLowerCase(),
          passwordHash: adminPasswordHash,
          fullName: dto.adminFullName,
          role: "NETWORK_ADMIN",
        },
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

  /** Kirish sahifasi uchun: faqat nom va slug, boshqa maydonlar ochilmaydi. */
  findPublicBySlug(slug: string) {
    return this.prisma.organization.findUnique({ where: { slug }, select: { name: true, slug: true } });
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
      return await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.create({
          data: {
            organizationId,
            name: dto.name,
            address: dto.address,
            slug: await this.generateUniqueBranchSlug(organizationId, dto.name, tx),
          },
        });

        if (dto.managerFullName && dto.managerEmail && dto.managerPassword) {
          const passwordHash = await argon2.hash(dto.managerPassword);
          await tx.tenantUser.create({
            data: {
              organizationId,
              branchId: branch.id,
              email: dto.managerEmail.toLowerCase(),
              passwordHash,
              fullName: dto.managerFullName,
              role: "BRANCH_ADMIN",
            },
          });
        }

        return branch;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu nom yoki email bilan filial/foydalanuvchi allaqachon mavjud");
      }
      throw err;
    }
  }

  async getBranch(organizationId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    return branch;
  }

  async updateBranch(organizationId: string, branchId: string, dto: UpdateBranchDto) {
    await this.getBranch(organizationId, branchId);
    try {
      return await this.prisma.branch.update({
        where: { id: branchId },
        data: dto,
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

  private async generateUniqueBranchSlug(
    organizationId: string,
    name: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await client.branch.findUnique({
        where: { organizationId_slug: { organizationId, slug: candidate } },
      });
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
