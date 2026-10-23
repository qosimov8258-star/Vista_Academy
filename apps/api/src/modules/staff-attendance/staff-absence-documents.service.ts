import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import type { StaffDocumentKind } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { sendMediaResponse } from "../../common/media-response";
import { R2Service } from "../storage/r2.service";
import { R2_CATEGORY } from "../storage/r2.constants";
import { TenantAuthenticatedUser, TenantScope, requireOperationalScope, toTenantScope } from "../iam/tenant-auth.types";

export const DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;
export const DOCUMENT_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
const KINDS: StaffDocumentKind[] = ["SICK_NOTE", "LEAVE_REQUEST", "OTHER"];
/** Hujjat biriktiriladigan kunlar — xodim kelmagan kunlar */
const ABSENT_STATUSES = ["ABSENT", "SICK", "ON_LEAVE"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 62;

const toDay = (d: Date) => d.toISOString().slice(0, 10);

/** Ro'yxatda qaytadigan ko'rinish — fayl baytlarisiz */
const documentSelect = {
  id: true,
  employeeId: true,
  kind: true,
  dates: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  note: true,
  uploadedByName: true,
  createdAt: true,
} as const;

/**
 * Xodimning kelmagan kun(lar)i uchun hujjat (kasallik varaqasi, ariza):
 * bitta fayl bir nechta kunga biriktiriladi. Davomat holatini o'zgartirmaydi,
 * shuning uchun kun qulflangan (ish haqi hisoblangan) bo'lsa ham qo'shiladi.
 * Yuklash va o'chirish — filial admini va administrator; ko'rish — davomatni
 * ko'ra oladigan rollar (o'qituvchi va oshpazdan boshqa).
 */
@Injectable()
export class StaffAbsenceDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async upload(
    caller: TenantAuthenticatedUser,
    file: Express.Multer.File | undefined,
    body: { employeeId?: string; dates?: string; kind?: string; note?: string },
  ) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    if (!file) throw new BadRequestException("Fayl tanlanmagan");
    if (!DOCUMENT_MIME.test(file.mimetype)) throw new BadRequestException("Faqat rasm (jpg, png, heic) yoki PDF qabul qilinadi");
    const kind = (body.kind ?? "SICK_NOTE") as StaffDocumentKind;
    if (!KINDS.includes(kind)) throw new BadRequestException("Hujjat turi noto'g'ri");
    const note = body.note?.trim().slice(0, 300) || null;

    const days = [...new Set((body.dates ?? "").split(",").map((d) => d.trim()).filter(Boolean))].sort();
    if (!days.length) throw new BadRequestException("Kamida bitta kunni tanlang");
    if (days.length > MAX_DAYS || days.some((d) => !DATE_RE.test(d))) throw new BadRequestException("Kunlar noto'g'ri");

    const employee = await this.prisma.employee.findFirst({
      where: { id: body.employeeId ?? "", organizationId: scope.organizationId },
      select: { id: true, branchId: true },
    });
    if (!employee) throw new NotFoundException("Xodim topilmadi");
    if (employee.branchId !== branchId) throw new ForbiddenException("Bu xodimga kirish huquqingiz yo'q");

    // Faqat kelmagan deb belgilangan kunlar — boshqa kunga hujjat isbot bo'lmaydi
    const records = await this.prisma.employeeAttendance.findMany({
      where: { employeeId: employee.id, date: { in: days.map((d) => new Date(`${d}T00:00:00.000Z`)) } },
      select: { date: true, status: true },
    });
    const absent = new Set(records.filter((r) => (ABSENT_STATUSES as readonly string[]).includes(r.status)).map((r) => toDay(r.date)));
    const wrong = days.filter((d) => !absent.has(d));
    if (wrong.length) {
      throw new BadRequestException(`Bu kunlarda xodim kelmagan deb belgilanmagan: ${wrong.join(", ")}`);
    }

    let fileKey: string | null = null;
    let fileBytes: Uint8Array<ArrayBuffer> | null = Uint8Array.from(file.buffer);
    if (this.r2.enabled) {
      fileKey = this.r2.buildKey(scope.organizationId, R2_CATEGORY.STAFF_DOCUMENT);
      await this.r2.uploadBuffer(fileKey, file.buffer, file.mimetype);
      fileBytes = null;
    }
    try {
      return await this.prisma.staffAbsenceDocument.create({
        data: {
          organizationId: scope.organizationId,
          branchId,
          employeeId: employee.id,
          kind,
          dates: days.map((d) => new Date(`${d}T00:00:00.000Z`)),
          fileName: file.originalname.slice(0, 200) || "hujjat",
          mimeType: file.mimetype,
          sizeBytes: file.size,
          fileKey,
          fileBytes,
          note,
          uploadedByName: caller.fullName,
        },
        select: documentSelect,
      });
    } catch (error) {
      if (fileKey) await this.r2.deleteObject(fileKey).catch(() => undefined);
      throw error;
    }
  }

  /** Xodimning shu oydagi hujjatlari (`employeeId` + `period`) yoki filialning shu kundagilari (`date`) */
  async list(caller: TenantAuthenticatedUser, query: { employeeId?: string; period?: string; date?: string; branchId?: string }) {
    const scope = toTenantScope(caller);
    const branchId = await this.readBranch(scope, query.branchId);
    if (query.date) {
      if (!DATE_RE.test(query.date)) throw new BadRequestException("Sana noto'g'ri");
      return this.prisma.staffAbsenceDocument.findMany({
        where: { branchId, dates: { has: new Date(`${query.date}T00:00:00.000Z`) } },
        orderBy: { createdAt: "asc" },
        select: documentSelect,
      });
    }
    if (!query.employeeId || !query.period || !/^\d{4}-\d{2}$/.test(query.period)) {
      throw new BadRequestException("Xodim va oy (YYYY-MM) kerak");
    }
    const [y, m] = query.period.split("-").map(Number);
    const monthDays = Array.from({ length: new Date(Date.UTC(y, m, 0)).getUTCDate() }, (_, i) => new Date(Date.UTC(y, m - 1, i + 1)));
    return this.prisma.staffAbsenceDocument.findMany({
      where: { branchId, employeeId: query.employeeId, dates: { hasSome: monthDays } },
      orderBy: { createdAt: "asc" },
      select: documentSelect,
    });
  }

  async sendFile(caller: TenantAuthenticatedUser, id: string, res: Response) {
    const doc = await this.findReadable(caller, id, { fileKey: true, fileBytes: true, mimeType: true, fileName: true });
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`);
    res.setHeader("Cache-Control", "private, no-store");
    await sendMediaResponse(res, this.r2, { key: doc.fileKey, bytes: doc.fileBytes, mimeType: doc.mimeType }, "Hujjat fayli topilmadi");
  }

  async remove(caller: TenantAuthenticatedUser, id: string) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    const doc = await this.prisma.staffAbsenceDocument.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: { id: true, fileKey: true },
    });
    if (!doc) throw new NotFoundException("Hujjat topilmadi");
    await this.prisma.staffAbsenceDocument.delete({ where: { id: doc.id } });
    if (doc.fileKey) await this.r2.deleteObject(doc.fileKey).catch(() => undefined);
    return { deleted: true };
  }

  private async findReadable<T extends Record<string, true>>(caller: TenantAuthenticatedUser, id: string, select: T) {
    const scope = toTenantScope(caller);
    this.assertReader(scope);
    const doc = await this.prisma.staffAbsenceDocument.findFirst({
      where: { id, organizationId: scope.organizationId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
      select,
    });
    if (!doc) throw new NotFoundException("Hujjat topilmadi");
    return doc;
  }

  private assertReader(scope: TenantScope) {
    if (scope.role === "TEACHER" || scope.role === "CHEF") throw new ForbiddenException("Bu ma'lumotni ko'rish huquqingiz yo'q");
  }

  private async readBranch(scope: TenantScope, queryBranchId?: string): Promise<string> {
    this.assertReader(scope);
    if (scope.branchId && queryBranchId && queryBranchId !== scope.branchId) throw new ForbiddenException("Bu filialga kirish huquqingiz yo'q");
    const branchId = scope.branchId ?? queryBranchId;
    if (!branchId) throw new BadRequestException("Filialni tanlang");
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: scope.organizationId }, select: { id: true } });
    if (!branch) throw new NotFoundException("Filial topilmadi");
    return branch.id;
  }
}
