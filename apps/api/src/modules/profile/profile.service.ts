import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateAvatarDto } from "./dto/update-avatar.dto";

/** Rasm 256x256 gacha kichraytirilgani uchun bundan oshmasligi kerak. */
const MAX_AVATAR_BYTES = 300 * 1024;

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(user: TenantAuthenticatedUser, dto: UpdateProfileDto) {
    const updated = await this.prisma.tenantUser.update({
      where: { id: user.id },
      data: { fullName: dto.fullName.trim() },
      select: { id: true, fullName: true, email: true },
    });
    return updated;
  }

  /**
   * Parolni almashtiradi va boshqa qurilmalardagi seanslarni yopadi.
   *
   * Joriy parol so'raladi: kimdir ochiq qolgan kompyuterdan parolni
   * o'zgartirib, egasini o'z hisobidan chiqarib yubormasligi kerak.
   */
  async changePassword(user: TenantAuthenticatedUser, dto: ChangePasswordDto) {
    const record = await this.prisma.tenantUser.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    const valid = await argon2.verify(record.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException("Joriy parol noto'g'ri");
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException("Yangi parol eskisidan farq qilishi kerak");
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.tenantUser.update({ where: { id: user.id }, data: { passwordHash } }),
      // Parol o'zgargach eski refresh tokenlar ishlamasin — parol oshkor
      // bo'lgan bo'lsa, boshqa qurilmadagi seans ham uzilishi kerak.
      this.prisma.tenantRefreshToken.updateMany({
        where: { tenantUserId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { changed: true };
  }

  async updateAvatar(user: TenantAuthenticatedUser, dto: UpdateAvatarDto) {
    const [header, base64] = dto.image.split(",", 2);
    const mimeType = header.slice("data:".length, header.indexOf(";"));
    const buffer = Buffer.from(base64, "base64");

    if (buffer.byteLength === 0) {
      throw new BadRequestException("Rasm bo'sh");
    }
    if (buffer.byteLength > MAX_AVATAR_BYTES) {
      throw new BadRequestException("Rasm hajmi juda katta");
    }

    const updated = await this.prisma.tenantUser.update({
      where: { id: user.id },
      data: { avatar: buffer, avatarMimeType: mimeType, avatarUpdatedAt: new Date() },
      select: { avatarUpdatedAt: true },
    });
    return { avatarUpdatedAt: updated.avatarUpdatedAt };
  }

  async removeAvatar(user: TenantAuthenticatedUser) {
    await this.prisma.tenantUser.update({
      where: { id: user.id },
      data: { avatar: null, avatarMimeType: null, avatarUpdatedAt: null },
    });
    return { avatarUpdatedAt: null };
  }

  async readAvatar(user: TenantAuthenticatedUser) {
    const record = await this.prisma.tenantUser.findUniqueOrThrow({
      where: { id: user.id },
      select: { avatar: true, avatarMimeType: true },
    });
    return record;
  }
}
