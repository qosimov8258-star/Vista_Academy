import { Body, Controller, Delete, Get, Header, Patch, Post, Put, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { sendMediaResponse } from "../../common/media-response";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { R2Service } from "../storage/r2.service";
import { ProfileService } from "./profile.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ChangeLoginDto } from "./dto/change-login.dto";
import { UpdateAvatarDto } from "./dto/update-avatar.dto";
import { UpdateThemeDto } from "./dto/update-theme.dto";
import { AllowChef } from "../iam/decorators/allow-chef.decorator";

@ApiBearerAuth()
@ApiTags("Tenant Profile")
@Public()
@UseGuards(TenantJwtAuthGuard)
@AllowChef()
@Controller("app/profile")
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly r2: R2Service,
  ) {}

  @Patch()
  updateProfile(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(user, dto);
  }

  @Post("password")
  changePassword(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.profileService.changePassword(user, dto);
  }

  @Post("login")
  changeLogin(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: ChangeLoginDto) {
    return this.profileService.changeLogin(user, dto);
  }

  /** Sozlamalar → Tizim rangi */
  @Put("theme")
  updateTheme(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: UpdateThemeDto) {
    return this.profileService.updateTheme(user, dto);
  }

  @Put("avatar")
  updateAvatar(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: UpdateAvatarDto) {
    return this.profileService.updateAvatar(user, dto);
  }

  @Delete("avatar")
  removeAvatar(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.profileService.removeAvatar(user);
  }

  /**
   * Rasmni binar ko'rinishda qaytaradi. `<img src>` shu manzilni ishlatadi,
   * shuning uchun javob umumiy `{ success, data }` qobig'iga o'ralmaydi.
   */
  @Get("avatar")
  @Header("Cache-Control", "private, max-age=60")
  async readAvatar(@CurrentTenantUser() user: TenantAuthenticatedUser, @Res() res: Response) {
    const record = await this.profileService.readAvatar(user);
    await sendMediaResponse(
      res,
      this.r2,
      { key: record.avatarKey, bytes: record.avatar, mimeType: record.avatarMimeType ?? "image/jpeg" },
      "Profil rasmi yo'q",
    );
  }
}
