import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
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
import { ProfileService } from "./profile.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateAvatarDto } from "./dto/update-avatar.dto";

@ApiBearerAuth()
@ApiTags("Tenant Profile")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Patch()
  updateProfile(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(user, dto);
  }

  @Post("password")
  changePassword(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.profileService.changePassword(user, dto);
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
    if (!record.avatar) {
      throw new NotFoundException("Profil rasmi yo'q");
    }
    res.setHeader("Content-Type", record.avatarMimeType ?? "image/jpeg");
    res.send(Buffer.from(record.avatar));
  }
}
