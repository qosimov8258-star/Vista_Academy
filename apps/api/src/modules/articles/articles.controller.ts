import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
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
import { ArticlesService } from "./articles.service";
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
    private readonly r2: R2Service,
  ) {}

  @Get()
  list(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: ArticleQueryDto) {
    return this.articles.list(toTenantScope(user), query);
  }

  @Get(":id")
  findOne(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.articles.findOne(toTenantScope(user), id);
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
    private readonly r2: R2Service,
  ) {}

  @Get()
  list(@CurrentParent() parent: AuthenticatedParent) {
    return this.articles.listForParent(parent);
  }

  @Get(":id")
  findOne(@CurrentParent() parent: AuthenticatedParent, @Param("id", ParseUUIDPipe) id: string) {
    return this.articles.findForParent(parent, id);
  }

  @Get(":id/cover")
  @Header("Cache-Control", "private, max-age=86400")
  async cover(@CurrentParent() parent: AuthenticatedParent, @Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const media = await this.articles.coverForParent(parent, id);
    await sendMediaResponse(res, this.r2, media, "Muqova yo'q");
  }
}
