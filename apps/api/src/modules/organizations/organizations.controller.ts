import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PlatformUserRole } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { OrganizationsService } from "./organizations.service";
import { OrganizationLifecycleService } from "./organization-lifecycle.service";
import { ArchiveOrganizationDto, SuspendOrganizationDto } from "./dto/organization-lifecycle.dto";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { OrganizationQueryDto } from "./dto/organization-query.dto";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateOrganizationAdminDto } from "./dto/update-organization-admin.dto";

@ApiBearerAuth()
@ApiTags("Platform Organizations")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("platform/organizations")
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly lifecycle: OrganizationLifecycleService,
  ) {}

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN, PlatformUserRole.PLATFORM_SUPPORT)
  @Get()
  findAll(@Query() query: OrganizationQueryDto) {
    return this.organizationsService.findAll(query);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN, PlatformUserRole.PLATFORM_SUPPORT)
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.organizationsService.findOne(id);
  }

  /** Tarif limitlariga nisbatan foydalanish, filiallar, administratorlar. */
  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN, PlatformUserRole.PLATFORM_SUPPORT)
  @Get(":id/usage")
  getUsage(@Param("id") id: string) {
    return this.lifecycle.getUsage(id);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post(":id/suspend")
  suspend(@Param("id") id: string, @Body() dto: SuspendOrganizationDto) {
    return this.lifecycle.suspend(id, dto.reason);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post(":id/activate")
  activate(@Param("id") id: string) {
    return this.lifecycle.activate(id);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post(":id/archive")
  archive(@Param("id") id: string, @Body() dto: ArchiveOrganizationDto) {
    return this.lifecycle.archive(id, dto.confirmSlug);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post(":id/restore")
  restore(@Param("id") id: string) {
    return this.lifecycle.restore(id);
  }

  /** "Bog'chaga kirish" — 60 soniyalik bir martalik chipta (qarang: platform-entry-ticket.ts). */
  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post(":id/enter")
  enter(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.lifecycle.createEntryTicket(id, user);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post(":id/branches")
  addBranch(@Param("id") id: string, @Body() dto: CreateBranchDto) {
    return this.organizationsService.addBranch(id, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Get(":id/admin")
  getAdminAccount(@Param("id") id: string) {
    return this.organizationsService.getAdminAccount(id);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Get(":id/admin/password")
  revealAdminPassword(
    @Param("id") id: string,
    @Headers("x-reveal-token") revealToken: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.revealAdminPassword(id, revealToken, user.id);
  }

  /** Super Admin login/parolini qo'lda o'zgartiradi (avtomatik generatsiya emas). */
  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch(":id/admin")
  updateAdminAccount(@Param("id") id: string, @Body() dto: UpdateOrganizationAdminDto) {
    return this.organizationsService.updateAdminAccount(id, dto);
  }

  /**
   * Tashkilotni BUTUNLAY o'chiradi (hard delete) — qaytarib bo'lmaydi.
   * Faqat Platform Super Admin uchun va faqat arxivlangan bog'cha —
   * tasodifiy o'chirishdan ikki bosqichli himoya.
   */
  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.organizationsService.remove(id);
  }
}
