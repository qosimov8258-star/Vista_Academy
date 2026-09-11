import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { OrganizationsService } from "./organizations.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
import { UpdateBranchAvatarDto } from "./dto/update-branch-avatar.dto";

@ApiBearerAuth()
@ApiTags("Tenant Organization")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/organizations")
export class TenantOrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get("me")
  async getCurrent(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    const organization = await this.organizationsService.findOne(user.organizationId);
    if (!user.branchId) {
      return organization;
    }
    // Branch-scoped roles (Kichik admin / menejer) only see their own branch,
    // and org-wide financials (wallet/subscription) are none of their business.
    const { wallet: _wallet, subscription: _subscription, ...rest } = organization;
    return { ...rest, branches: organization.branches.filter((b) => b.id === user.branchId) };
  }

  @Post("me/branches")
  addBranch(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateBranchDto) {
    if (user.role !== "NETWORK_ADMIN") {
      throw new ForbiddenException("Faqat Super Admin yangi filial qo'sha oladi");
    }
    return this.organizationsService.addBranch(user.organizationId, dto);
  }

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
  @Get("me/branches/:branchId/avatar")
  @Header("Cache-Control", "private, max-age=60")
  async readBranchAvatar(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("branchId") branchId: string,
    @Res() res: Response,
  ) {
    this.requireBranchAccess(user, branchId);
    const record = await this.organizationsService.readBranchAvatar(user.organizationId, branchId);
    if (!record.avatar) {
      throw new NotFoundException("Filial belgisi yo'q");
    }
    res.setHeader("Content-Type", record.avatarMimeType ?? "image/jpeg");
    res.send(Buffer.from(record.avatar));
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
    if (user.role === "FINANCE" || user.role === "TEACHER") {
      throw new ForbiddenException("Filial ma'lumotlarini o'zgartirish huquqingiz yo'q");
    }
  }
}
