import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { sendMediaResponse } from "../../common/media-response";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { CurrentParent } from "../parent/decorators/current-parent.decorator";
import { ParentJwtAuthGuard } from "../parent/guards/parent-jwt-auth.guard";
import { AuthenticatedParent } from "../parent/parent-auth.types";
import { R2Service } from "../storage/r2.service";
import { ArticleFeedbackService } from "./article-feedback.service";
import { ArticlesService } from "./articles.service";
import { ArticleReactionDto, CreateArticleCommentDto } from "./dto/article-feedback.dto";
import { ArticleQueryDto, CreateArticleDto, UpdateArticleDto } from "./dto/article.dto";

/** Xodimlar: maqola yozish va boshqarish */
@ApiBearerAuth()
@ApiTags("Tenant Articles")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/articles")
export class ArticlesController {
  constructor(
    private readonly articles: ArticlesService,
    private readonly feedback: ArticleFeedbackService,
    private readonly r2: R2Service,
  ) {}

  /** Har maqolada layk, dizlayk va izohlar soni ham bor */
  @Get()
  async list(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: ArticleQueryDto) {
    const rows = await this.articles.list(toTenantScope(user), query);
    const counts = await this.feedback.counts(rows.map((row) => row.id));
    return rows.map((row) => ({ ...row, feedback: counts.get(row.id) ?? { likes: 0, dislikes: 0, comments: 0 } }));
  }

  @Get(":id")
  async findOne(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    const row = await this.articles.findOne(toTenantScope(user), id);
    return { ...row, feedback: await this.feedback.countsFor(id) };
  }

  /** Izohlar va baho soni (kim baho qo'ygani ko'rsatilmaydi) */
  @Get(":id/comments")
  comments(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.feedback.listForStaff(toTenantScope(user), id);
  }

  /** Bog'cha nomidan izoh yoki javob */
  @Post(":id/comments")
  comment(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateArticleCommentDto) {
    return this.feedback.commentAsStaff(toTenantScope(user), id, dto);
  }

  /** Istalgan izohni o'chirish (moderatsiya) */
  @Delete(":id/comments/:commentId")
  removeComment(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("commentId", ParseUUIDPipe) commentId: string,
  ) {
    return this.feedback.deleteAsStaff(toTenantScope(user), id, commentId);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateArticleDto) {
    return this.articles.create(toTenantScope(user), dto);
  }

  @Patch(":id")
  update(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateArticleDto) {
    return this.articles.update(toTenantScope(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.articles.remove(toTenantScope(user), id);
  }

  /** Muqova — binar, `{ success, data }` qobig'isiz */
  @Get(":id/cover")
  @Header("Cache-Control", "private, max-age=300")
  async cover(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const media = await this.articles.coverForStaff(toTenantScope(user), id);
    await sendMediaResponse(res, this.r2, media, "Muqova yo'q");
  }
}

/** Ota-onalar: bolasi filiali/guruhiga e'lon qilingan maqolalar */
@ApiTags("Parent Articles")
@Public()
@UseGuards(ParentJwtAuthGuard)
@Controller("app/parent/articles")
export class ParentArticlesController {
  constructor(
    private readonly articles: ArticlesService,
    private readonly feedback: ArticleFeedbackService,
    private readonly r2: R2Service,
  ) {}

  @Get()
  list(@CurrentParent() parent: AuthenticatedParent) {
    return this.articles.listForParent(parent);
  }

  @Get(":id")
  async findOne(@CurrentParent() parent: AuthenticatedParent, @Param("id", ParseUUIDPipe) id: string) {
    const article = await this.articles.findForParent(parent, id);
    return { ...article, feedback: await this.feedback.summaryForParent(parent, id) };
  }

  /** Layk/dizlayk — anonim; `kind: null` bahoni olib tashlaydi */
  @Put(":id/reaction")
  react(@CurrentParent() parent: AuthenticatedParent, @Param("id", ParseUUIDPipe) id: string, @Body() dto: ArticleReactionDto) {
    return this.feedback.react(parent, id, dto.kind);
  }

  @Get(":id/comments")
  comments(@CurrentParent() parent: AuthenticatedParent, @Param("id", ParseUUIDPipe) id: string) {
    return this.feedback.listForParent(parent, id);
  }

  @Post(":id/comments")
  comment(@CurrentParent() parent: AuthenticatedParent, @Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateArticleCommentDto) {
    return this.feedback.commentAsParent(parent, id, dto);
  }

  /** Faqat o'z izohini */
  @Delete(":id/comments/:commentId")
  removeComment(
    @CurrentParent() parent: AuthenticatedParent,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("commentId", ParseUUIDPipe) commentId: string,
  ) {
    return this.feedback.deleteAsParent(parent, id, commentId);
  }

  @Get(":id/cover")
  @Header("Cache-Control", "private, max-age=86400")
  async cover(@CurrentParent() parent: AuthenticatedParent, @Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const media = await this.articles.coverForParent(parent, id);
    await sendMediaResponse(res, this.r2, media, "Muqova yo'q");
  }
}
