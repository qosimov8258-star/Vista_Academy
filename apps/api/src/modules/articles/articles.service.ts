import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UsefulStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { resolveTeacherGroupIds } from "../iam/teacher-scope";
import { AuthenticatedParent } from "../parent/parent-auth.types";
import { R2Service } from "../storage/r2.service";
import { R2_CATEGORY } from "../storage/r2.constants";
import {
  MAX_CONTENT_IMAGE_BYTES,
  decodeImageDataUrl,
  parentChildrenScope,
  requireContentView,
  resolveContentGroupForWrite,
  resolveContentReadBranch,
} from "../useful/content-scope";
import { estimateReadingMinutes, parseTaleParagraphs } from "../useful/useful-text.util";
import { ArticleQueryDto, ArticleTipDto, CreateArticleDto, UpdateArticleDto } from "./dto/article.dto";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

/** Rasm baytlarisiz — ro'yxat va bitta maqola uchun */
const ARTICLE_SELECT = {
  id: true,
  organizationId: true,
  branchId: true,
  groupId: true,
  category: true,
  title: true,
  summary: true,
  body: true,
  tips: true,
  memo: true,
  coverKey: true,
  coverMimeType: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, fullName: true } },
  group: { select: { id: true, name: true } },
  branch: { select: { timezone: true } },
} satisfies Prisma.ArticleSelect;

type ArticleRow = Prisma.ArticleGetPayload<{ select: typeof ARTICLE_SELECT }>;

function formatDate(date: Date, timezone: string | null | undefined): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone ?? DEFAULT_TIMEZONE }).format(date);
}

function cleanTips(tips: ArticleTipDto[] | undefined): Prisma.InputJsonValue {
  return (tips ?? [])
    .map((tip) => ({ title: tip.title.trim(), text: tip.text.trim() }))
    .filter((tip) => tip.title && tip.text);
}

function readTips(value: Prisma.JsonValue): Array<{ title: string; text: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((tip) =>
    tip && typeof tip === "object" && !Array.isArray(tip) && typeof tip.title === "string" && typeof tip.text === "string"
      ? [{ title: tip.title, text: tip.text }]
      : [],
  );
}

/**
 * «Ota-onalarga eslatma» — maqolalar. Ruxsatlar «Foydali» bo'limi bilan bir
 * xil (qarang: useful/content-scope.ts). Muqova base64 bilan keladi va R2
 * yoqilgan bo'lsa o'sha yerda, aks holda bazada saqlanadi.
 */
@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  // ---------------------------------------------------------------------
  // Xodimlar
  // ---------------------------------------------------------------------

  async list(scope: TenantScope, query: ArticleQueryDto) {
    const branchId = await resolveContentReadBranch(this.prisma, scope, query.branchId);
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    const and: Prisma.ArticleWhereInput[] = [{ organizationId: scope.organizationId }, { deletedAt: null }];
    if (branchId) and.push({ branchId });
    if (query.status) and.push({ status: query.status });
    if (query.category) and.push({ category: query.category });
    if (query.groupId) and.push({ groupId: query.groupId });
    if (teacherGroupIds !== null) and.push({ OR: [{ groupId: { in: teacherGroupIds } }, { groupId: null }] });
    const rows = await this.prisma.article.findMany({ where: { AND: and }, select: ARTICLE_SELECT, orderBy: { createdAt: "desc" } });
    return rows.map((row) => this.toStaff(row));
  }

  async findOne(scope: TenantScope, id: string) {
    return this.toStaff(await this.requireVisible(scope, id));
  }

  async create(scope: TenantScope, dto: CreateArticleDto) {
    const branchId = requireTeachingScope(scope);
    const groupId = await resolveContentGroupForWrite(this.prisma, scope, branchId, dto.groupId);
    const cover = dto.cover ? await this.storeCover(scope.organizationId, dto.cover) : null;
    const row = await this.prisma.article.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        groupId,
        category: dto.category,
        title: dto.title.trim(),
        summary: dto.summary.trim(),
        body: dto.body.trim(),
        tips: cleanTips(dto.tips),
        memo: dto.memo?.trim() || null,
        status: dto.status ?? UsefulStatus.PUBLISHED,
        createdById: scope.userId,
        ...(cover ?? {}),
      },
      select: ARTICLE_SELECT,
    });
    return this.toStaff(row);
  }

  async update(scope: TenantScope, id: string, dto: UpdateArticleDto) {
    const branchId = requireTeachingScope(scope);
    const existing = await this.requireEditable(scope, id);
    const data: Prisma.ArticleUncheckedUpdateInput = {};
    if (dto.groupId !== undefined) data.groupId = await resolveContentGroupForWrite(this.prisma, scope, branchId, dto.groupId);
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.summary !== undefined) data.summary = dto.summary.trim();
    if (dto.body !== undefined) data.body = dto.body.trim();
    if (dto.tips !== undefined) data.tips = cleanTips(dto.tips);
    if (dto.memo !== undefined) data.memo = dto.memo?.trim() || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.cover !== undefined) {
      const next = dto.cover ? await this.storeCover(scope.organizationId, dto.cover) : { cover: null, coverKey: null, coverMimeType: null };
      Object.assign(data, next);
      if (existing.coverKey) await this.r2.deleteObject(existing.coverKey).catch(() => undefined);
    }
    const row = await this.prisma.article.update({ where: { id }, data, select: ARTICLE_SELECT });
    return this.toStaff(row);
  }

  async remove(scope: TenantScope, id: string) {
    requireTeachingScope(scope);
    await this.requireEditable(scope, id);
    await this.prisma.article.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }

  async coverForStaff(scope: TenantScope, id: string) {
    await this.requireVisible(scope, id);
    return this.coverMedia(id);
  }

  // ---------------------------------------------------------------------
  // Ota-onalar
  // ---------------------------------------------------------------------

  async listForParent(parent: AuthenticatedParent) {
    const rows = await this.prisma.article.findMany({
      where: await this.parentWhere(parent),
      select: ARTICLE_SELECT,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((row) => {
      const { paragraphs: _paragraphs, tips: _tips, memo: _memo, ...rest } = this.toParent(row);
      return rest;
    });
  }

  async findForParent(parent: AuthenticatedParent, id: string) {
    const row = await this.prisma.article.findFirst({ where: { AND: [{ id }, await this.parentWhere(parent)] }, select: ARTICLE_SELECT });
    if (!row) throw new NotFoundException("Maqola topilmadi");
    return this.toParent(row);
  }

  async coverForParent(parent: AuthenticatedParent, id: string) {
    const visible = await this.prisma.article.count({ where: { AND: [{ id }, await this.parentWhere(parent)] } });
    if (!visible) throw new NotFoundException("Maqola topilmadi");
    return this.coverMedia(id);
  }

  // ---------------------------------------------------------------------

  /** Ota-ona: bolasi bor filialdagi umumiy maqolalar + bolasi guruhiga yozilganlari */
  private async parentWhere(parent: AuthenticatedParent): Promise<Prisma.ArticleWhereInput> {
    const scope = await parentChildrenScope(this.prisma, parent);
    return {
      organizationId: parent.organizationId,
      status: UsefulStatus.PUBLISHED,
      deletedAt: null,
      OR: [{ groupId: null, branchId: { in: scope.branchIds } }, { groupId: { in: scope.groupIds } }],
    };
  }

  private async storeCover(organizationId: string, dataUrl: string) {
    const { buffer, mimeType } = decodeImageDataUrl(dataUrl, MAX_CONTENT_IMAGE_BYTES);
    if (this.r2.enabled) {
      const coverKey = this.r2.buildKey(organizationId, R2_CATEGORY.ARTICLE_COVER);
      await this.r2.uploadBuffer(coverKey, buffer, mimeType);
      return { cover: null, coverKey, coverMimeType: mimeType };
    }
    return { cover: new Uint8Array(buffer), coverKey: null, coverMimeType: mimeType };
  }

  private async coverMedia(id: string) {
    const row = await this.prisma.article.findUnique({ where: { id }, select: { cover: true, coverKey: true, coverMimeType: true } });
    return { key: row?.coverKey ?? null, bytes: row?.cover ?? null, mimeType: row?.coverMimeType ?? null };
  }

  private async requireVisible(scope: TenantScope, id: string) {
    requireContentView(scope);
    const row = await this.prisma.article.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
      select: ARTICLE_SELECT,
    });
    if (!row || (scope.branchId && row.branchId !== scope.branchId)) {
      throw new NotFoundException("Maqola topilmadi");
    }
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    if (teacherGroupIds !== null && row.groupId && !teacherGroupIds.includes(row.groupId)) {
      throw new NotFoundException("Maqola topilmadi");
    }
    return row;
  }

  private async requireEditable(scope: TenantScope, id: string) {
    const row = await this.prisma.article.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
      select: { id: true, branchId: true, createdById: true, coverKey: true },
    });
    if (!row) throw new NotFoundException("Maqola topilmadi");
    if (scope.branchId && row.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu maqolaga kirish huquqingiz yo'q");
    }
    if (scope.role === "TEACHER" && row.createdById !== scope.userId) {
      throw new ForbiddenException("Faqat o'zingiz yozgan maqolani tahrirlay/o'chira olasiz");
    }
    return row;
  }

  private readMinutes(row: ArticleRow): number {
    const tips = readTips(row.tips);
    return estimateReadingMinutes([...parseTaleParagraphs(row.body), ...tips.map((tip) => `${tip.title} ${tip.text}`)]);
  }

  private toStaff(row: ArticleRow) {
    const { coverKey, coverMimeType, branch: _branch, ...rest } = row;
    return {
      ...rest,
      tips: readTips(row.tips),
      hasCover: Boolean(coverKey || coverMimeType),
      readMinutes: this.readMinutes(row),
    };
  }

  private toParent(row: ArticleRow) {
    return {
      id: row.id,
      category: row.category,
      title: row.title,
      summary: row.summary,
      paragraphs: parseTaleParagraphs(row.body),
      tips: readTips(row.tips),
      memo: row.memo,
      hasCover: Boolean(row.coverKey || row.coverMimeType),
      /** Muqova o'zgarganda brauzer keshi yangilanishi uchun */
      version: row.updatedAt.getTime(),
      readMinutes: this.readMinutes(row),
      addedBy: row.createdBy.fullName,
      groupName: row.group?.name ?? null,
      addedAt: formatDate(row.createdAt, row.branch.timezone),
    };
  }
}
