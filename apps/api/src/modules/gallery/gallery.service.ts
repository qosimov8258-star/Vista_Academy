import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { AuthenticatedParent } from "../parent/parent-auth.types";
import { R2Service } from "../storage/r2.service";
import { R2_CATEGORY } from "../storage/r2.constants";
import {
  MAX_CONTENT_IMAGE_BYTES,
  decodeImageDataUrl,
  parentChildrenScope,
  resolveContentGroupForWrite,
  resolveContentReadBranch,
} from "../useful/content-scope";
import { CreateGalleryItemDto, GalleryQueryDto, UpdateGalleryItemDto } from "./dto/gallery.dto";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

const ITEM_SELECT = {
  id: true,
  branchId: true,
  groupId: true,
  title: true,
  likesCount: true,
  createdById: true,
  createdAt: true,
  group: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
  branch: { select: { timezone: true } },
} satisfies Prisma.GalleryItemSelect;

/**
 * Galereya — bolalar ishlari muzeyi. Tarbiyachi (o'z guruhlari), filial
 * admini va menejer suratga olib yuklaydi; filialdagi hamma ota-onalar
 * ko'radi va «Yoqdi» bosadi (bitta ishga bitta). Tarbiyachi galereyani
 * butun filial bo'yicha ko'radi, lekin faqat o'zi yuklaganini o'chiradi.
 */
@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  // ---------------------------------------------------------------------
  // Xodimlar
  // ---------------------------------------------------------------------

  async list(scope: TenantScope, query: GalleryQueryDto) {
    const branchId = await resolveContentReadBranch(this.prisma, scope, query.branchId);
    const rows = await this.prisma.galleryItem.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(query.groupId ? { groupId: query.groupId } : {}),
      },
      select: ITEM_SELECT,
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return rows.map(({ branch: _branch, ...row }) => row);
  }

  async create(scope: TenantScope, dto: CreateGalleryItemDto) {
    const branchId = requireTeachingScope(scope);
    const groupId = (await resolveContentGroupForWrite(this.prisma, scope, branchId, dto.groupId, true))!;
    const { buffer, mimeType } = decodeImageDataUrl(dto.image, MAX_CONTENT_IMAGE_BYTES);
    let image: Uint8Array<ArrayBuffer> | null = new Uint8Array(buffer);
    let imageKey: string | null = null;
    if (this.r2.enabled) {
      imageKey = this.r2.buildKey(scope.organizationId, R2_CATEGORY.GALLERY_IMAGE);
      await this.r2.uploadBuffer(imageKey, buffer, mimeType);
      image = null;
    }
    const { branch: _branch, ...row } = await this.prisma.galleryItem.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        groupId,
        title: dto.title?.trim() || null,
        image,
        imageKey,
        imageMimeType: mimeType,
        createdById: scope.userId,
      },
      select: ITEM_SELECT,
    });
    return row;
  }

  async update(scope: TenantScope, id: string, dto: UpdateGalleryItemDto) {
    requireTeachingScope(scope);
    await this.requireEditable(scope, id);
    const { branch: _branch, ...row } = await this.prisma.galleryItem.update({
      where: { id },
      data: { title: dto.title?.trim() || null },
      select: ITEM_SELECT,
    });
    return row;
  }

  async remove(scope: TenantScope, id: string) {
    requireTeachingScope(scope);
    const item = await this.requireEditable(scope, id);
    await this.prisma.galleryItem.update({ where: { id }, data: { deletedAt: new Date() } });
    if (item.imageKey) await this.r2.deleteObject(item.imageKey).catch(() => undefined);
    return { id };
  }

  async imageForStaff(scope: TenantScope, id: string) {
    const branchId = await resolveContentReadBranch(this.prisma, scope);
    const visible = await this.prisma.galleryItem.count({
      where: { id, organizationId: scope.organizationId, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!visible) throw new NotFoundException("Rasm topilmadi");
    return this.imageMedia(id);
  }

  // ---------------------------------------------------------------------
  // Ota-onalar
  // ---------------------------------------------------------------------

  async listForParent(parent: AuthenticatedParent) {
    const { branchIds } = await parentChildrenScope(this.prisma, parent);
    const rows = await this.prisma.galleryItem.findMany({
      where: { organizationId: parent.organizationId, branchId: { in: branchIds }, deletedAt: null },
      select: { ...ITEM_SELECT, likes: { where: { guardianId: parent.id }, select: { guardianId: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      groupId: row.groupId,
      groupName: row.group.name,
      likesCount: row.likesCount,
      liked: row.likes.length > 0,
      addedAt: new Intl.DateTimeFormat("en-CA", { timeZone: row.branch.timezone ?? DEFAULT_TIMEZONE }).format(row.createdAt),
    }));
  }

  /** «Yoqdi» — bosilsa qo'yiladi, yana bosilsa olinadi. Hisoblagich shu tranzaksiyada yangilanadi. */
  async toggleLike(parent: AuthenticatedParent, id: string) {
    await this.requireParentVisible(parent, id);
    return this.prisma.$transaction(async (tx) => {
      const removed = await tx.galleryLike.deleteMany({ where: { itemId: id, guardianId: parent.id } });
      if (removed.count > 0) {
        const item = await tx.galleryItem.update({ where: { id }, data: { likesCount: { decrement: 1 } }, select: { likesCount: true } });
        return { liked: false, likesCount: Math.max(0, item.likesCount) };
      }
      await tx.galleryLike.create({ data: { itemId: id, guardianId: parent.id } });
      const item = await tx.galleryItem.update({ where: { id }, data: { likesCount: { increment: 1 } }, select: { likesCount: true } });
      return { liked: true, likesCount: item.likesCount };
    });
  }

  async imageForParent(parent: AuthenticatedParent, id: string) {
    await this.requireParentVisible(parent, id);
    return this.imageMedia(id);
  }

  // ---------------------------------------------------------------------

  private async requireParentVisible(parent: AuthenticatedParent, id: string) {
    const { branchIds } = await parentChildrenScope(this.prisma, parent);
    const visible = await this.prisma.galleryItem.count({
      where: { id, organizationId: parent.organizationId, branchId: { in: branchIds }, deletedAt: null },
    });
    if (!visible) throw new NotFoundException("Rasm topilmadi");
  }

  private async imageMedia(id: string) {
    const row = await this.prisma.galleryItem.findUnique({ where: { id }, select: { image: true, imageKey: true, imageMimeType: true } });
    return { key: row?.imageKey ?? null, bytes: row?.image ?? null, mimeType: row?.imageMimeType ?? null };
  }

  private async requireEditable(scope: TenantScope, id: string) {
    const item = await this.prisma.galleryItem.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
      select: { id: true, branchId: true, createdById: true, imageKey: true },
    });
    if (!item) throw new NotFoundException("Rasm topilmadi");
    if (scope.branchId && item.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu rasmga kirish huquqingiz yo'q");
    }
    if (scope.role === "TEACHER" && item.createdById !== scope.userId) {
      throw new ForbiddenException("Faqat o'zingiz yuklagan rasmni o'zgartira/o'chira olasiz");
    }
    return item;
  }
}
