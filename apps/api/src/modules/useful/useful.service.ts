import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UsefulStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsGroup, resolveTeacherGroupIds } from "../iam/teacher-scope";
import { CreatePoemDto } from "./dto/create-poem.dto";
import { UpdatePoemDto } from "./dto/update-poem.dto";
import { CreateProverbDto } from "./dto/create-proverb.dto";
import { UpdateProverbDto } from "./dto/update-proverb.dto";
import { CreateTaleDto } from "./dto/create-tale.dto";
import { UpdateTaleDto } from "./dto/update-tale.dto";
import { UsefulQueryDto } from "./dto/useful-query.dto";
import { estimateReadingMinutes, parsePoemStanzas, parseTaleParagraphs } from "./useful-text.util";

const CREATED_BY_SELECT = { select: { id: true, fullName: true } };
const GROUP_SELECT = { select: { id: true, name: true } };

@Injectable()
export class UsefulService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Poems
  // ---------------------------------------------------------------------

  async findPoems(scope: TenantScope, query: UsefulQueryDto) {
    const branchId = await this.requireReadBranch(scope, query.branchId);
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    return this.prisma.poem.findMany({
      where: this.buildPoemWhere(scope.organizationId, branchId, query, teacherGroupIds),
      include: { createdBy: CREATED_BY_SELECT, group: GROUP_SELECT },
      orderBy: { createdAt: "desc" },
    });
  }

  async findPoem(scope: TenantScope, id: string) {
    return this.requireVisiblePoem(scope, id);
  }

  async createPoem(scope: TenantScope, dto: CreatePoemDto) {
    const branchId = requireTeachingScope(scope);
    const groupId = await this.resolveGroupForWrite(scope, branchId, dto.groupId);
    const { ageFrom, ageTo } = this.resolveAgeRange(dto.ageFrom, dto.ageTo, 3, 6);
    const stanzas = parsePoemStanzas(dto.text);

    return this.prisma.poem.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        groupId,
        title: dto.title,
        author: dto.author ?? null,
        ageFrom,
        ageTo,
        stanzas,
        status: dto.status ?? UsefulStatus.PUBLISHED,
        createdById: scope.userId,
      },
      include: { createdBy: CREATED_BY_SELECT, group: GROUP_SELECT },
    });
  }

  async updatePoem(scope: TenantScope, id: string, dto: UpdatePoemDto) {
    const branchId = requireTeachingScope(scope);
    const existing = await this.requireEditablePoem(scope, id);
    const groupId = dto.groupId !== undefined ? await this.resolveGroupForWrite(scope, branchId, dto.groupId) : undefined;
    const { ageFrom, ageTo } = this.resolveAgeRange(
      dto.ageFrom ?? existing.ageFrom,
      dto.ageTo ?? existing.ageTo,
      existing.ageFrom,
      existing.ageTo,
    );
    const stanzas = dto.text !== undefined ? parsePoemStanzas(dto.text) : undefined;

    return this.prisma.poem.update({
      where: { id: existing.id },
      data: { title: dto.title, author: dto.author, groupId, ageFrom, ageTo, stanzas, status: dto.status },
      include: { createdBy: CREATED_BY_SELECT, group: GROUP_SELECT },
    });
  }

  async removePoem(scope: TenantScope, id: string) {
    requireTeachingScope(scope);
    const existing = await this.requireEditablePoem(scope, id);
    await this.prisma.poem.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    return { id: existing.id };
  }

  private buildPoemWhere(
    organizationId: string,
    branchId: string | null,
    query: UsefulQueryDto,
    teacherGroupIds: string[] | null,
  ): Prisma.PoemWhereInput {
    const and: Prisma.PoemWhereInput[] = [{ organizationId }, { deletedAt: null }];
    if (branchId) and.push({ branchId });
    if (query.status) and.push({ status: query.status });
    if (query.groupId) and.push({ groupId: query.groupId });
    if (teacherGroupIds !== null) {
      and.push({ OR: [{ groupId: { in: teacherGroupIds } }, { groupId: null }] });
    }
    return { AND: and };
  }

  private async requireVisiblePoem(scope: TenantScope, id: string) {
    this.requireCanView(scope);
    const poem = await this.prisma.poem.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
      include: { createdBy: CREATED_BY_SELECT, group: GROUP_SELECT },
    });
    if (!poem) {
      throw new NotFoundException("She'r topilmadi");
    }
    if (scope.branchId && poem.branchId !== scope.branchId) {
      throw new NotFoundException("She'r topilmadi");
    }
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    if (teacherGroupIds !== null && poem.groupId && !teacherGroupIds.includes(poem.groupId)) {
      throw new NotFoundException("She'r topilmadi");
    }
    return poem;
  }

  private async requireEditablePoem(scope: TenantScope, id: string) {
    const poem = await this.prisma.poem.findFirst({ where: { id, organizationId: scope.organizationId, deletedAt: null } });
    if (!poem) {
      throw new NotFoundException("She'r topilmadi");
    }
    if (scope.branchId && poem.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu mazmunga kirish huquqingiz yo'q");
    }
    if (scope.role === "TEACHER" && poem.createdById !== scope.userId) {
      throw new ForbiddenException("Faqat o'zingiz qo'shgan mazmunni tahrirlay/o'chira olasiz");
    }
    return poem;
  }

  // ---------------------------------------------------------------------
  // Proverbs
  // ---------------------------------------------------------------------

  async findProverbs(scope: TenantScope, query: UsefulQueryDto) {
    const branchId = await this.requireReadBranch(scope, query.branchId);
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    return this.prisma.proverb.findMany({
      where: this.buildProverbWhere(scope.organizationId, branchId, query, teacherGroupIds),
      include: { createdBy: CREATED_BY_SELECT, group: GROUP_SELECT },
      orderBy: { createdAt: "desc" },
    });
  }

  async findProverb(scope: TenantScope, id: string) {
    return this.requireVisibleProverb(scope, id);
  }

  async createProverb(scope: TenantScope, dto: CreateProverbDto) {
    const branchId = requireTeachingScope(scope);
    const groupId = await this.resolveGroupForWrite(scope, branchId, dto.groupId);

    return this.prisma.proverb.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        groupId,
        text: dto.text,
        meaning: dto.meaning,
        status: dto.status ?? UsefulStatus.PUBLISHED,
        createdById: scope.userId,
      },
      include: { createdBy: CREATED_BY_SELECT, group: GROUP_SELECT },
    });
  }

  async updateProverb(scope: TenantScope, id: string, dto: UpdateProverbDto) {
    const branchId = requireTeachingScope(scope);
    const existing = await this.requireEditableProverb(scope, id);
    const groupId = dto.groupId !== undefined ? await this.resolveGroupForWrite(scope, branchId, dto.groupId) : undefined;

    return this.prisma.proverb.update({
      where: { id: existing.id },
      data: { text: dto.text, meaning: dto.meaning, groupId, status: dto.status },
      include: { createdBy: CREATED_BY_SELECT, group: GROUP_SELECT },
    });
  }

  async removeProverb(scope: TenantScope, id: string) {
    requireTeachingScope(scope);
    const existing = await this.requireEditableProverb(scope, id);
    await this.prisma.proverb.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    return { id: existing.id };
  }

  private buildProverbWhere(
    organizationId: string,
    branchId: string | null,
    query: UsefulQueryDto,
    teacherGroupIds: string[] | null,
  ): Prisma.ProverbWhereInput {
    const and: Prisma.ProverbWhereInput[] = [{ organizationId }, { deletedAt: null }];
    if (branchId) and.push({ branchId });
    if (query.status) and.push({ status: query.status });
    if (query.groupId) and.push({ groupId: query.groupId });
    if (teacherGroupIds !== null) {
      and.push({ OR: [{ groupId: { in: teacherGroupIds } }, { groupId: null }] });
    }
    return { AND: and };
  }

  private async requireVisibleProverb(scope: TenantScope, id: string) {
    this.requireCanView(scope);
    const proverb = await this.prisma.proverb.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
      include: { createdBy: CREATED_BY_SELECT, group: GROUP_SELECT },
    });
    if (!proverb) {
      throw new NotFoundException("Maqol topilmadi");
    }
    if (scope.branchId && proverb.branchId !== scope.branchId) {
      throw new NotFoundException("Maqol topilmadi");
    }
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    if (teacherGroupIds !== null && proverb.groupId && !teacherGroupIds.includes(proverb.groupId)) {
      throw new NotFoundException("Maqol topilmadi");
    }
    return proverb;
  }

  private async requireEditableProverb(scope: TenantScope, id: string) {
    const proverb = await this.prisma.proverb.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
    if (!proverb) {
      throw new NotFoundException("Maqol topilmadi");
    }
    if (scope.branchId && proverb.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu mazmunga kirish huquqingiz yo'q");
    }
    if (scope.role === "TEACHER" && proverb.createdById !== scope.userId) {
      throw new ForbiddenException("Faqat o'zingiz qo'shgan mazmunni tahrirlay/o'chira olasiz");
    }
    return proverb;
  }

  // ---------------------------------------------------------------------
  // Tales
  // ---------------------------------------------------------------------

  async findTales(scope: TenantScope, query: UsefulQueryDto) {
    const branchId = await this.requireReadBranch(scope, query.branchId);
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    return this.prisma.tale.findMany({
      where: this.buildTaleWhere(scope.organizationId, branchId, query, teacherGroupIds),
      include: { createdBy: CREATED_BY_SELECT, group: GROUP_SELECT },
      orderBy: { createdAt: "desc" },
    });
  }

  async findTale(scope: TenantScope, id: string) {
    return this.requireVisibleTale(scope, id);
  }

  async createTale(scope: TenantScope, dto: CreateTaleDto) {
    const branchId = requireTeachingScope(scope);
    const groupId = await this.resolveGroupForWrite(scope, branchId, dto.groupId);
    const { ageFrom, ageTo } = this.resolveAgeRange(dto.ageFrom, dto.ageTo, 3, 7);
    const paragraphs = parseTaleParagraphs(dto.text);
    const minutes = dto.minutes ?? estimateReadingMinutes(paragraphs);

    return this.prisma.tale.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        groupId,
        title: dto.title,
        origin: dto.origin,
        minutes,
        paragraphs,
        moral: dto.moral,
        questions: dto.questions ?? [],
        cover: dto.cover ?? "tun",
        ageFrom,
        ageTo,
        status: dto.status ?? UsefulStatus.PUBLISHED,
        createdById: scope.userId,
      },
      include: { createdBy: CREATED_BY_SELECT, group: GROUP_SELECT },
    });
  }

  async updateTale(scope: TenantScope, id: string, dto: UpdateTaleDto) {
    const branchId = requireTeachingScope(scope);
    const existing = await this.requireEditableTale(scope, id);
    const groupId = dto.groupId !== undefined ? await this.resolveGroupForWrite(scope, branchId, dto.groupId) : undefined;
    const { ageFrom, ageTo } = this.resolveAgeRange(
      dto.ageFrom ?? existing.ageFrom,
      dto.ageTo ?? existing.ageTo,
      existing.ageFrom,
      existing.ageTo,
    );
    const paragraphs = dto.text !== undefined ? parseTaleParagraphs(dto.text) : undefined;
    const minutes = dto.minutes !== undefined ? dto.minutes ?? estimateReadingMinutes(paragraphs ?? (existing.paragraphs as string[])) : undefined;

    return this.prisma.tale.update({
      where: { id: existing.id },
      data: {
        title: dto.title,
        origin: dto.origin,
        minutes,
        paragraphs,
        moral: dto.moral,
        questions: dto.questions,
        cover: dto.cover,
        groupId,
        ageFrom,
        ageTo,
        status: dto.status,
      },
      include: { createdBy: CREATED_BY_SELECT, group: GROUP_SELECT },
    });
  }

  async removeTale(scope: TenantScope, id: string) {
    requireTeachingScope(scope);
    const existing = await this.requireEditableTale(scope, id);
    await this.prisma.tale.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    return { id: existing.id };
  }

  private buildTaleWhere(
    organizationId: string,
    branchId: string | null,
    query: UsefulQueryDto,
    teacherGroupIds: string[] | null,
  ): Prisma.TaleWhereInput {
    const and: Prisma.TaleWhereInput[] = [{ organizationId }, { deletedAt: null }];
    if (branchId) and.push({ branchId });
    if (query.status) and.push({ status: query.status });
    if (query.groupId) and.push({ groupId: query.groupId });
    if (teacherGroupIds !== null) {
      and.push({ OR: [{ groupId: { in: teacherGroupIds } }, { groupId: null }] });
    }
    return { AND: and };
  }

  private async requireVisibleTale(scope: TenantScope, id: string) {
    this.requireCanView(scope);
    const tale = await this.prisma.tale.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
      include: { createdBy: CREATED_BY_SELECT, group: GROUP_SELECT },
    });
    if (!tale) {
      throw new NotFoundException("Ertak topilmadi");
    }
    if (scope.branchId && tale.branchId !== scope.branchId) {
      throw new NotFoundException("Ertak topilmadi");
    }
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    if (teacherGroupIds !== null && tale.groupId && !teacherGroupIds.includes(tale.groupId)) {
      throw new NotFoundException("Ertak topilmadi");
    }
    return tale;
  }

  private async requireEditableTale(scope: TenantScope, id: string) {
    const tale = await this.prisma.tale.findFirst({ where: { id, organizationId: scope.organizationId, deletedAt: null } });
    if (!tale) {
      throw new NotFoundException("Ertak topilmadi");
    }
    if (scope.branchId && tale.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu mazmunga kirish huquqingiz yo'q");
    }
    if (scope.role === "TEACHER" && tale.createdById !== scope.userId) {
      throw new ForbiddenException("Faqat o'zingiz qo'shgan mazmunni tahrirlay/o'chira olasiz");
    }
    return tale;
  }

  // ---------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------

  /** FINANCE bu bo'limni umuman ko'ra olmaydi (o'qish ham, yozish ham). */
  private requireCanView(scope: TenantScope): void {
    if (scope.role === "FINANCE") {
      throw new ForbiddenException("Moliyachi bu bo'limni ko'ra olmaydi");
    }
  }

  /**
   * O'qish uchun filialni aniqlaydi: filial darajasidagi rollar o'z filiali
   * bilan cheklangan, NETWORK_ADMIN esa `?branchId=` bilan tanlaydi (bo'sh
   * qoldirilsa — butun tashkilot bo'ylab).
   */
  private async requireReadBranch(scope: TenantScope, queryBranchId?: string): Promise<string | null> {
    this.requireCanView(scope);
    if (scope.branchId) {
      if (queryBranchId && queryBranchId !== scope.branchId) {
        throw new ForbiddenException("Bu filialga kirish huquqingiz yo'q");
      }
      return scope.branchId;
    }
    if (!queryBranchId) {
      return null;
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: queryBranchId, organizationId: scope.organizationId } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    return branch.id;
  }

  /**
   * `groupId`ni yozishdan oldin tekshiradi: o'qituvchi uchun majburiy va
   * o'z guruhi bo'lishi shart; boshqalar uchun ixtiyoriy (null — butun filial).
   */
  private async resolveGroupForWrite(
    scope: TenantScope,
    branchId: string,
    groupId: string | null | undefined,
  ): Promise<string | null> {
    if (scope.role === "TEACHER" && !groupId) {
      throw new BadRequestException("Guruhni tanlang");
    }
    if (!groupId) {
      return null;
    }
    const group = await this.prisma.group.findFirst({ where: { id: groupId, branch: { organizationId: scope.organizationId } } });
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }
    if (group.branchId !== branchId) {
      throw new ForbiddenException("Bu guruhga kirish huquqingiz yo'q");
    }
    await assertTeacherOwnsGroup(this.prisma, scope, group.id);
    return group.id;
  }

  /** `ageFrom <= ageTo` shartini tekshiradi, berilmagan qiymatlarga sukut bo'yicha son beradi. */
  private resolveAgeRange(
    ageFrom: number | undefined,
    ageTo: number | undefined,
    defaultFrom: number,
    defaultTo: number,
  ): { ageFrom: number; ageTo: number } {
    const from = ageFrom ?? defaultFrom;
    const to = ageTo ?? defaultTo;
    if (from > to) {
      throw new BadRequestException("Yosh oralig'i noto'g'ri: boshlanishi tugashidan katta bo'lmasligi kerak");
    }
    return { ageFrom: from, ageTo: to };
  }
}
