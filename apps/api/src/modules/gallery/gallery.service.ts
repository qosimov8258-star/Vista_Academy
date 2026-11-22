import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { canNotifyParents } from "../../common/features/feature-access";
import { PushService } from "../push/push.service";
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
import { CreateGalleryItemDto, GALLERY_MAX_IMAGES, GalleryQueryDto, UpdateGalleryItemDto } from "./dto/gallery.dto";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

/**
 * Tarbiyachi odatda bir nechta ishni ketma-ket yuklaydi — shu oraliqda bitta
 * guruhga ikkinchi push yuborilmaydi (ota-ona telefoni 5 marta jiringlamasin).
 */
const PUSH_QUIET_MS = 10 * 60_000;

const ITEM_SELECT = {
  id: true,
  branchId: true,
  groupId: true,
  title: true,
  description: true,
  likesCount: true,
  createdById: true,
  createdAt: true,
  group: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
  branch: { select: { timezone: true } },
  // 2–5-rasmlar soni (1-rasm ishning o'zida)
  _count: { select: { images: true } },
} satisfies Prisma.GalleryItemSelect;

/** Ro'yxat qatori: ichki maydonlar o'rniga rasmlar soni */
function toRow<T extends { branch: unknown; _count: { images: number } }>({ branch: _branch, _count, ...row }: T) {
  return { ...row, imageCount: 1 + _count.images };
}

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
    private readonly push: PushService,
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
    return rows.map(toRow);
  }

  /**
   * Yangi ish: 1–5 ta rasm (tartibda, birinchisi — muqova) va ixtiyoriy nom/matn.
   * Hamma rasm avval tekshiriladi — bittasi yaroqsiz bo'lsa hech narsa saqlanmaydi.
   */
  async create(scope: TenantScope, dto: CreateGalleryItemDto) {
    const branchId = requireTeachingScope(scope);
    const groupId = (await resolveContentGroupForWrite(this.prisma, scope, branchId, dto.groupId, true))!;
    const sources = dto.images?.length ? dto.images : dto.image ? [dto.image] : [];
    if (sources.length === 0) throw new BadRequestException("Kamida bitta rasm tanlang");
    if (sources.length > GALLERY_MAX_IMAGES) throw new BadRequestException(`Ko'pi bilan ${GALLERY_MAX_IMAGES} ta rasm yuklash mumkin`);
    const decoded = sources.map((source) => decodeImageDataUrl(source, MAX_CONTENT_IMAGE_BYTES));
    const stored = [];
    for (const { buffer, mimeType } of decoded) stored.push(await this.storeImage(scope.organizationId, buffer, mimeType));
    const [cover, ...extra] = stored;
    const recent = await this.prisma.galleryItem.count({
      where: { groupId, createdById: scope.userId, createdAt: { gte: new Date(Date.now() - PUSH_QUIET_MS) } },
    });
    const created = await this.prisma.galleryItem.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        groupId,
        title: dto.title?.trim() || null,
        description: dto.description?.trim() || null,
        image: cover.image,
        imageKey: cover.imageKey,
        imageMimeType: cover.mimeType,
        createdById: scope.userId,
        images: { create: extra.map((img, i) => ({ position: i + 1, image: img.image, imageKey: img.imageKey, mimeType: img.mimeType })) },
      },
      select: ITEM_SELECT,
    });
    if (recent === 0) {
      // Push xatosi yuklashni to'xtatmaydi
      void this.notifyParents(scope.organizationId, groupId, created.group.name).catch(() => undefined);
    }
    return toRow(created);
  }

  /** Rasm R2'ga (yoqilgan bo'lsa) yoki bazaga — qaysi biri ishlatilganini qaytaradi */
  private async storeImage(organizationId: string, buffer: Buffer, mimeType: string) {
    if (this.r2.enabled) {
      const imageKey = this.r2.buildKey(organizationId, R2_CATEGORY.GALLERY_IMAGE);
      await this.r2.uploadBuffer(imageKey, buffer, mimeType);
      return { image: null, imageKey, mimeType };
    }
    return { image: new Uint8Array(buffer) as Uint8Array<ArrayBuffer>, imageKey: null, mimeType };
  }

  /**
   * Shu guruh bolalarining ota-onalariga: «galereyaga yangi ish qo'shildi».
   * Galereyani butun filial ko'radi, lekin push faqat o'z guruhiga — boshqa
   * guruhlarning har bir rasmi uchun hammani bezovta qilmaslik uchun.
   */
  private async notifyParents(organizationId: string, groupId: string, groupName: string) {
    // Ota-onada kabinet, bildirishnomalar yoki galereya o'chiq bo'lsa push yo'q
    if (!(await canNotifyParents(this.prisma, organizationId, "gallery"))) return;
    const [links, organization] = await Promise.all([
      this.prisma.childGuardian.findMany({
        where: { canReceiveNotifications: true, child: { groupId, status: "ACTIVE" } },
        select: { guardianId: true },
        distinct: ["guardianId"],
      }),
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true } }),
    ]);
    if (links.length === 0 || !organization) return;
    await this.push.sendToGuardians(links.map((link) => link.guardianId), {
      title: "Galereyada yangi ish",
      body: `«${groupName}» guruhi bolalarining yangi ishi qo'shildi. Ko'rib, «Yoqdi» bosing!`,
      url: `/ota-ona/${organization.slug}/galereya`,
    });
  }

  async update(scope: TenantScope, id: string, dto: UpdateGalleryItemDto) {
    requireTeachingScope(scope);
    await this.requireEditable(scope, id);
    const updated = await this.prisma.galleryItem.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title?.trim() || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      },
      select: ITEM_SELECT,
    });
    return toRow(updated);
  }

  async remove(scope: TenantScope, id: string) {
    requireTeachingScope(scope);
    const item = await this.requireEditable(scope, id);
    await this.prisma.galleryItem.update({ where: { id }, data: { deletedAt: new Date() } });
    if (item.imageKey) await this.r2.deleteObject(item.imageKey).catch(() => undefined);
    for (const extra of item.images) {
      if (extra.imageKey) await this.r2.deleteObject(extra.imageKey).catch(() => undefined);
    }
    return { id };
  }

  async imageForStaff(scope: TenantScope, id: string, index = 0) {
    const branchId = await resolveContentReadBranch(this.prisma, scope);
    const visible = await this.prisma.galleryItem.count({
      where: { id, organizationId: scope.organizationId, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!visible) throw new NotFoundException("Rasm topilmadi");
    return this.imageMedia(id, index);
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
      description: row.description,
      imageCount: 1 + row._count.images,
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

  async imageForParent(parent: AuthenticatedParent, id: string, index = 0) {
    await this.requireParentVisible(parent, id);
    return this.imageMedia(id, index);
  }

  // ---------------------------------------------------------------------

  private async requireParentVisible(parent: AuthenticatedParent, id: string) {
    const { branchIds } = await parentChildrenScope(this.prisma, parent);
    const visible = await this.prisma.galleryItem.count({
      where: { id, organizationId: parent.organizationId, branchId: { in: branchIds }, deletedAt: null },
    });
    if (!visible) throw new NotFoundException("Rasm topilmadi");
  }

  /** `index`: 0 — ishning o'zidagi muqova, 1–4 — qo'shimcha rasmlar */
  private async imageMedia(id: string, index = 0) {
    if (index > 0) {
      const extra = await this.prisma.galleryImage.findUnique({
        where: { itemId_position: { itemId: id, position: index } },
        select: { image: true, imageKey: true, mimeType: true },
      });
      return { key: extra?.imageKey ?? null, bytes: extra?.image ?? null, mimeType: extra?.mimeType ?? null };
    }
    const row = await this.prisma.galleryItem.findUnique({ where: { id }, select: { image: true, imageKey: true, imageMimeType: true } });
    return { key: row?.imageKey ?? null, bytes: row?.image ?? null, mimeType: row?.imageMimeType ?? null };
  }

  private async requireEditable(scope: TenantScope, id: string) {
    const item = await this.prisma.galleryItem.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
      select: { id: true, branchId: true, createdById: true, imageKey: true, images: { select: { imageKey: true } } },
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
