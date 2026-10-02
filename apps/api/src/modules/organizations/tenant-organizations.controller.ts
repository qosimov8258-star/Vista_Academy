import { Body, Controller, Delete, ForbiddenException, Get, Header, Param, Patch, Post, Put, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { sendMediaResponse } from "../../common/media-response";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { R2Service } from "../storage/r2.service";
import { OrganizationsService } from "./organizations.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
import { UpdateBranchAvatarDto } from "./dto/update-branch-avatar.dto";
import { UpdateOrganizationNameDto } from "./dto/update-organization-name.dto";
import { DeleteBranchDto } from "./dto/delete-branch.dto";
import { AllowChef } from "../iam/decorators/allow-chef.decorator";

@ApiBearerAuth()
@ApiTags("Tenant Organization")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/organizations")
export class TenantOrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly r2: R2Service,
  ) {}

  @AllowChef()

  @Get("me")
  async getCurrent(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    const organization = await this.organizationsService.findOne(user.organizationId);
    if (!user.branchId) {
      return organization;
    }
    // Branch-scoped roles (Kichik admin / menejer) only see their own branch,
    // and org-wide financials (wallet/subscription) are none of their business.
    const { wallet: _wallet, subscription: _subscription, ...rest } = organization;
    // Moliyachi (FINANCE) filialga biriktirilgan bo'lsa ham butun tarmoqni
    // ko'radi — yon paneldagi filial tanlovi uchun to'liq filiallar ro'yxati
    // kerak (platforma hisob-kitobi esa baribir yashirin qoladi).
    if (user.role === "FINANCE") {
      return rest;
    }
    return { ...rest, branches: organization.branches.filter((b) => b.id === user.branchId) };
  }

  @Post("me/branches")
  addBranch(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateBranchDto) {
    if (user.role !== "NETWORK_ADMIN") {
      throw new ForbiddenException("Faqat Super Admin yangi filial qo'sha oladi");
    }
    return this.organizationsService.addBranch(user.organizationId, dto);
  }

  /** Tashkilot nomini (brend/logo) o'zgartirish — Sozlamalar bo'limida, Super Admin va filial admini. */
  @Patch("me")
  updateName(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: UpdateOrganizationNameDto) {
    if (user.role !== "NETWORK_ADMIN" && user.role !== "BRANCH_ADMIN") {
      throw new ForbiddenException("Faqat Super Admin yoki filial admini tashkilot nomini o'zgartira oladi");
    }
    return this.organizationsService.updateName(user.organizationId, dto.name);
  }

  @AllowChef()

  @Get("me/branches/:branchId")
  getBranch(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("branchId") branchId: string) {
    this.requireBranchAccess(user, branchId);
    return this.organizationsService.getBranch(user.organizationId, branchId);
  }

  @Patch("me/branches/:branchId")
  updateBranch(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: UpdateBranchDto,
  ) {
    this.requireBranchWriteAccess(user, branchId);
    return this.organizationsService.updateBranch(user, branchId, dto);
  }

  /** O'chirishdan oldin: filialda nechta bola, xodim, to'lov bor — tasdiqlash oynasi uchun. */
  @Get("me/branches/:branchId/deletion-summary")
  getBranchDeletionSummary(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("branchId") branchId: string) {
    this.requireNetworkAdmin(user);
    return this.organizationsService.getBranchDeletionSummary(user.organizationId, branchId);
  }

  /** Filialni butunlay o'chirish — faqat Super Admin, filial nomini yozib tasdiqlaydi. */
  @Delete("me/branches/:branchId")
  removeBranch(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: DeleteBranchDto,
  ) {
    this.requireNetworkAdmin(user);
    return this.organizationsService.removeBranch(user, branchId, dto.confirmName);
  }

  /** Filial belgisini yuklash. Filial admini o'z filialiga qo'ya oladi. */
  @Put("me/branches/:branchId/avatar")
  updateBranchAvatar(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: UpdateBranchAvatarDto,
  ) {
    this.requireBranchWriteAccess(user, branchId);
    return this.organizationsService.updateBranchAvatar(user.organizationId, branchId, dto);
  }

  @Delete("me/branches/:branchId/avatar")
  removeBranchAvatar(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("branchId") branchId: string) {
    this.requireBranchWriteAccess(user, branchId);
    return this.organizationsService.removeBranchAvatar(user.organizationId, branchId);
  }

  /**
   * Rasmni binar ko'rinishda qaytaradi. `<img src>` shu manzilni ishlatadi,
   * shuning uchun javob umumiy `{ success, data }` qobig'iga o'ralmaydi.
   */
  @AllowChef()
  @Get("me/branches/:branchId/avatar")
  @Header("Cache-Control", "private, max-age=60")
  async readBranchAvatar(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("branchId") branchId: string,
    @Res() res: Response,
  ) {
    this.requireBranchAccess(user, branchId);
    const record = await this.organizationsService.readBranchAvatar(user.organizationId, branchId);
    await sendMediaResponse(
      res,
      this.r2,
      { key: record.avatarKey, bytes: record.avatar, mimeType: record.avatarMimeType ?? "image/jpeg" },
      "Filial belgisi yo'q",
    );
  }

  private requireNetworkAdmin(user: TenantAuthenticatedUser) {
    if (user.role !== "NETWORK_ADMIN") {
      throw new ForbiddenException("Faqat Super Admin filialni o'chira oladi");
    }
  }

  private requireBranchAccess(user: TenantAuthenticatedUser, branchId: string) {
    if (user.branchId && user.branchId !== branchId) {
      throw new ForbiddenException("Bu filialga kirish huquqingiz yo'q");
    }
  }

  /**
   * Filial ma'lumotlarini o'zgartirish — frontendda `canWriteOperational`
   * bilan bir xil rol to'plami (Moliyachi va O'qituvchi faqat ko'radi).
   * Ilgari bu yerda faqat filial mosligi tekshirilardi, rol umuman
   * tekshirilmasdi — ya'ni Moliyachi yoki O'qituvchi ham to'g'ridan-to'g'ri
   * so'rov bilan filial nomini/ish vaqtini o'zgartira olardi.
   */
  private requireBranchWriteAccess(user: TenantAuthenticatedUser, branchId: string) {
    this.requireBranchAccess(user, branchId);
    if (user.role === "FINANCE" || user.role === "TEACHER" || user.role === "CHEF") {
      throw new ForbiddenException("Filial ma'lumotlarini o'zgartirish huquqingiz yo'q");
    }
  }
}
