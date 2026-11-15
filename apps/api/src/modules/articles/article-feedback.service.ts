import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ArticleReactionKind, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { AuthenticatedParent } from "../parent/parent-auth.types";
import { ArticlesService } from "./articles.service";
import { CreateArticleCommentDto } from "./dto/article-feedback.dto";

const COMMENT_SELECT = {
  id: true,
  parentId: true,
  guardianId: true,
  staffUserId: true,
  body: true,
  createdAt: true,
  guardian: { select: { fullName: true } },
  staffUser: { select: { fullName: true } },
} satisfies Prisma.ArticleCommentSelect;

type CommentRow = Prisma.ArticleCommentGetPayload<{ select: typeof COMMENT_SELECT }>;

/** Kim ko'ryapti — «meniki» va «o'chira oladi» belgilari shunga qarab */
type Viewer = { kind: "parent"; guardianId: string } | { kind: "staff"; userId: string; canModerate: boolean };

export type FeedbackCounts = { likes: number; dislikes: number; comments: number };

const EMPTY_COUNTS: FeedbackCounts = { likes: 0, dislikes: 0, comments: 0 };

/** Bir maqolada ko'rsatiladigan izohlar chegarasi (eng eskilaridan) */
const MAX_THREADS = 300;

/**
 * Maqolaga fikr: layk/dizlayk va izohlar.
 *
 *   • Baho anonim — hamma faqat sonini ko'radi, kim bosgani hech kimga
 *     (xodimga ham) ko'rsatilmaydi.
 *   • Izoh anonim emas — ota-onaning ismi chiqadi. Maqolani ko'ra oladigan
 *     hamma (guruhga yozilgan bo'lsa — o'sha guruh ota-onalari) ko'radi.
 *   • Xodim (filial roli) «Bog'cha» nomidan javob yozadi va istalgan izohni
 *     o'chiradi; ota-ona faqat o'zinikini o'chiradi.
 *   • Javoblar bir daraja: javobga javob — o'sha ipning o'ziga qo'shiladi.
 */
@Injectable()
export class ArticleFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articles: ArticlesService,
  ) {}

  /** Ro'yxatlar uchun: har maqolaning layk, dizlayk va izohlar soni */
  async counts(articleIds: string[]): Promise<Map<string, FeedbackCounts>> {
    const result = new Map<string, FeedbackCounts>();
    if (articleIds.length === 0) return result;
    const [reactions, comments] = await Promise.all([
      this.prisma.articleReaction.groupBy({ by: ["articleId", "kind"], where: { articleId: { in: articleIds } }, _count: { _all: true } }),
      this.prisma.articleComment.groupBy({ by: ["articleId"], where: { articleId: { in: articleIds }, deletedAt: null }, _count: { _all: true } }),
    ]);
    const entry = (id: string) => {
      let value = result.get(id);
      if (!value) {
        value = { ...EMPTY_COUNTS };
        result.set(id, value);
      }
      return value;
    };
    for (const row of reactions) {
      if (row.kind === ArticleReactionKind.LIKE) entry(row.articleId).likes = row._count._all;
      else entry(row.articleId).dislikes = row._count._all;
    }
    for (const row of comments) entry(row.articleId).comments = row._count._all;
    return result;
  }

  async countsFor(articleId: string): Promise<FeedbackCounts> {
    return (await this.counts([articleId])).get(articleId) ?? { ...EMPTY_COUNTS };
  }

  // ---------------------------------------------------------------------
  // Ota-ona
  // ---------------------------------------------------------------------

  async summaryForParent(parent: AuthenticatedParent, articleId: string) {
    const [counts, mine] = await Promise.all([
      this.countsFor(articleId),
      this.prisma.articleReaction.findUnique({ where: { articleId_guardianId: { articleId, guardianId: parent.id } }, select: { kind: true } }),
    ]);
    return { ...counts, myReaction: mine?.kind ?? null };
  }

  async react(parent: AuthenticatedParent, articleId: string, kind: ArticleReactionKind | null) {
    await this.articles.assertVisibleToParent(parent, articleId);
    const key = { articleId_guardianId: { articleId, guardianId: parent.id } };
    if (kind === null) {
      await this.prisma.articleReaction.deleteMany({ where: { articleId, guardianId: parent.id } });
    } else {
      await this.prisma.articleReaction.upsert({ where: key, create: { articleId, guardianId: parent.id, kind }, update: { kind } });
    }
    return this.summaryForParent(parent, articleId);
  }

  async listForParent(parent: AuthenticatedParent, articleId: string) {
    await this.articles.assertVisibleToParent(parent, articleId);
    return this.threads(articleId, { kind: "parent", guardianId: parent.id });
  }

  async commentAsParent(parent: AuthenticatedParent, articleId: string, dto: CreateArticleCommentDto) {
    await this.articles.assertVisibleToParent(parent, articleId);
    const row = await this.create(articleId, dto, { guardianId: parent.id });
    return this.toItem(row, { kind: "parent", guardianId: parent.id });
  }

  async deleteAsParent(parent: AuthenticatedParent, articleId: string, commentId: string) {
    await this.articles.assertVisibleToParent(parent, articleId);
    const row = await this.prisma.articleComment.findFirst({
      where: { id: commentId, articleId, guardianId: parent.id, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException("Izoh topilmadi");
    await this.softDelete(row.id);
    return { id: row.id };
  }

  // ---------------------------------------------------------------------
  // Xodim
  // ---------------------------------------------------------------------

  async listForStaff(scope: TenantScope, articleId: string) {
    await this.articles.assertVisibleToStaff(scope, articleId);
    const canModerate = Boolean(scope.branchId) && scope.role !== "FINANCE" && scope.role !== "CHEF";
    const [counts, threads] = await Promise.all([
      this.countsFor(articleId),
      this.threads(articleId, { kind: "staff", userId: scope.userId, canModerate }),
    ]);
    return { ...counts, canModerate, items: threads };
  }

  async commentAsStaff(scope: TenantScope, articleId: string, dto: CreateArticleCommentDto) {
    requireTeachingScope(scope);
    await this.articles.assertVisibleToStaff(scope, articleId);
    const row = await this.create(articleId, dto, { staffUserId: scope.userId });
    return this.toItem(row, { kind: "staff", userId: scope.userId, canModerate: true });
  }

  async deleteAsStaff(scope: TenantScope, articleId: string, commentId: string) {
    requireTeachingScope(scope);
    await this.articles.assertVisibleToStaff(scope, articleId);
    const row = await this.prisma.articleComment.findFirst({ where: { id: commentId, articleId, deletedAt: null }, select: { id: true } });
    if (!row) throw new NotFoundException("Izoh topilmadi");
    await this.softDelete(row.id);
    return { id: row.id };
  }

  // ---------------------------------------------------------------------

  private async create(articleId: string, dto: CreateArticleCommentDto, author: { guardianId?: string; staffUserId?: string }) {
    const body = dto.body.trim();
    if (!body) throw new BadRequestException("Izoh bo'sh");
    let parentId: string | null = null;
    if (dto.parentId) {
      const target = await this.prisma.articleComment.findFirst({
        where: { id: dto.parentId, articleId, deletedAt: null },
        select: { id: true, parentId: true },
      });
      if (!target) throw new NotFoundException("Javob berilayotgan izoh topilmadi");
      // Javobga javob — o'sha ipning boshiga ulanadi (bir daraja)
      parentId = target.parentId ?? target.id;
    }
    return this.prisma.articleComment.create({
      data: { articleId, parentId, body, guardianId: author.guardianId ?? null, staffUserId: author.staffUserId ?? null },
      select: COMMENT_SELECT,
    });
  }

  /** Ip o'chirilsa — javoblari ham yashiriladi (Instagramdagidek) */
  private async softDelete(id: string) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.articleComment.update({ where: { id }, data: { deletedAt: now } }),
      this.prisma.articleComment.updateMany({ where: { parentId: id, deletedAt: null }, data: { deletedAt: now } }),
    ]);
  }

  private async threads(articleId: string, viewer: Viewer) {
    const roots = await this.prisma.articleComment.findMany({
      where: { articleId, parentId: null, deletedAt: null },
      select: { ...COMMENT_SELECT, replies: { where: { deletedAt: null }, select: COMMENT_SELECT, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
      take: MAX_THREADS,
    });
    return roots.map((root) => ({
      ...this.toItem(root, viewer),
      replies: root.replies.map((reply) => this.toItem(reply, viewer)),
    }));
  }

  private toItem(row: CommentRow, viewer: Viewer) {
    const isStaff = !row.guardianId;
    const mine = viewer.kind === "parent" ? row.guardianId === viewer.guardianId : isStaff && row.staffUserId === viewer.userId;
    return {
      id: row.id,
      parentId: row.parentId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      author: {
        name: isStaff ? (row.staffUser?.fullName ?? null) : (row.guardian?.fullName ?? ""),
        isStaff,
      },
      mine,
      canDelete: mine || (viewer.kind === "staff" && viewer.canModerate),
    };
  }
}
