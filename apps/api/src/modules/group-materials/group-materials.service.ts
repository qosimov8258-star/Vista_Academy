import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsGroup, resolveTeacherGroupIds } from "../iam/teacher-scope";
import { R2Service } from "../storage/r2.service";
import { R2_CATEGORY } from "../storage/r2.constants";
import { MATERIAL_LIMITS, MATERIAL_MIME_KINDS } from "./group-materials.constants";
import { UploadMaterialDto } from "./dto/upload-material.dto";

const LIST_SELECT = {
  id: true,
  groupId: true,
  title: true,
  description: true,
  kind: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdByName: true,
  createdAt: true,
} satisfies Prisma.GroupMaterialSelect;

/**
 * Guruh materiallari: tarbiyachi/o'qituvchi yuklaydi, shu guruhdagi bolalarning
 * ota-onalari kabinetda ko'radi (`ParentGroupMaterialsController`).
 */
@Injectable()
export class GroupMaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  /* ------------------------------------------------------------ tarbiyachi tomoni */

  async list(scope: TenantScope, groupId: string) {
    await this.requireGroup(scope, groupId);
    return this.prisma.groupMaterial.findMany({
      where: { groupId },
      select: LIST_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  async upload(
    scope: TenantScope,
    author: { id: string; fullName: string },
    groupId: string,
    file: Express.Multer.File | undefined,
    dto: UploadMaterialDto,
  ) {
    const group = await this.requireGroup(scope, groupId);
    if (!file || file.size === 0) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    const kind = MATERIAL_MIME_KINDS[file.mimetype];
    if (!kind) {
      throw new BadRequestException("Rasm, video, PDF, Word, Excel, PowerPoint yoki matn fayli yuklash mumkin");
    }
    if (file.size > MATERIAL_LIMITS.maxBytes) {
      throw new BadRequestException(`Fayl ${MATERIAL_LIMITS.maxBytes / 1024 / 1024} MB dan oshmasligi kerak`);
    }

    // Multer fayl nomini latin1 deb o'qiydi — o'zbekcha harflar buzilmasin
    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8").slice(0, 200);
    const title = dto.title?.trim() || originalName.replace(/\.[^.]+$/, "") || "Fayl";

    let data: Uint8Array<ArrayBuffer> | null = new Uint8Array(file.buffer);
    let dataKey: string | null = null;
    if (this.r2.enabled) {
      dataKey = this.r2.buildKey(group.organizationId, R2_CATEGORY.GROUP_MATERIAL);
      await this.r2.uploadBuffer(dataKey, file.buffer, file.mimetype);
      data = null;
    }

    return this.prisma.groupMaterial.create({
      data: {
        organizationId: group.organizationId,
        branchId: group.branchId,
        groupId: group.id,
        title: title.slice(0, MATERIAL_LIMITS.titleMaxLength),
        description: dto.description?.trim() || null,
        kind,
        originalName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        data,
        dataKey,
        createdById: author.id,
        createdByName: author.fullName,
      },
      select: LIST_SELECT,
    });
  }

  async remove(scope: TenantScope, id: string) {
    const material = await this.prisma.groupMaterial.findUnique({
      where: { id },
      select: { id: true, groupId: true, organizationId: true, dataKey: true },
    });
    if (!material || material.organizationId !== scope.organizationId) {
      throw new NotFoundException("Fayl topilmadi");
    }
    await this.requireGroup(scope, material.groupId);
    await this.prisma.groupMaterial.delete({ where: { id: material.id } });
    if (material.dataKey) {
      await this.r2.deleteObject(material.dataKey);
    }
    return { deleted: true };
  }

  /** Faylni xodimga yuboradi: o'qituvchi uchun faqat o'z guruhlari. */
  async sendForStaff(scope: TenantScope, id: string, res: Response) {
    const row = await this.prisma.groupMaterial.findUnique({
      where: { id },
      select: { groupId: true, organizationId: true },
    });
    if (!row || row.organizationId !== scope.organizationId) {
      throw new NotFoundException("Fayl topilmadi");
    }
    const teacherGroups = await resolveTeacherGroupIds(this.prisma, scope);
    if (teacherGroups && !teacherGroups.includes(row.groupId)) {
      throw new NotFoundException("Fayl topilmadi");
    }
    await this.send(id, res);
  }

  /* ------------------------------------------------------------ ota-ona tomoni */

  /** Bolaning guruhidagi materiallar */
  async listForChild(parent: { id: string; organizationId: string }, childId: string) {
    const link = await this.prisma.childGuardian.findFirst({
      where: { guardianId: parent.id, childId, child: { organizationId: parent.organizationId } },
      select: { child: { select: { groupId: true } } },
    });
    if (!link) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (!link.child.groupId) {
      return [];
    }
    return this.prisma.groupMaterial.findMany({
      where: { groupId: link.child.groupId },
      select: LIST_SELECT,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  /** Ota-onaning shu guruhda bolasi bo'lishi shart; aks holda 404 */
  async sendForParent(parent: { id: string; organizationId: string }, id: string, res: Response) {
    const row = await this.prisma.groupMaterial.findUnique({ where: { id }, select: { groupId: true } });
    const link = row
      ? await this.prisma.childGuardian.findFirst({
          where: { guardianId: parent.id, child: { organizationId: parent.organizationId, groupId: row.groupId } },
          select: { id: true },
        })
      : null;
    if (!link) {
      throw new NotFoundException("Fayl topilmadi");
    }
    await this.send(id, res);
  }

  /* ------------------------------------------------------------ yordamchilar */

  private async send(id: string, res: Response) {
    const row = await this.prisma.groupMaterial.findUnique({
      where: { id },
      select: { data: true, dataKey: true, mimeType: true, originalName: true },
    });
    if (!row || (!row.data && !row.dataKey)) {
      throw new NotFoundException("Fayl topilmadi");
    }
    if (row.dataKey) {
      res.setHeader("Cache-Control", "private, max-age=60");
      res.redirect(302, await this.r2.getPresignedReadUrl(row.dataKey));
      return;
    }
    const buffer = Buffer.from(row.data!);
    res.setHeader("Cache-Control", "private, max-age=86400, immutable");
    res.setHeader("Content-Type", row.mimeType);
    res.setHeader("Content-Length", String(buffer.byteLength));
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(row.originalName)}`);
    res.end(buffer);
  }

  private async requireGroup(scope: TenantScope, groupId: string) {
    const branchId = requireTeachingScope(scope);
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, branchId, branch: { organizationId: scope.organizationId } },
      select: { id: true, branchId: true, branch: { select: { organizationId: true } } },
    });
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }
    await assertTeacherOwnsGroup(this.prisma, scope, group.id);
    return { id: group.id, branchId: group.branchId, organizationId: group.branch.organizationId };
  }
}
