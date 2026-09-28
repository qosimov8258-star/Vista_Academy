import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope } from "../iam/tenant-auth.types";
import { requireKitchenWriteScope } from "./kitchen-scope";
import { UpsertMenuEntryDto } from "./dto/upsert-menu-entry.dto";
import { MenuQueryDto } from "./dto/menu-query.dto";
import { UploadMenuPhotoDto } from "./dto/upload-menu-photo.dto";
import { MenuPhotosQueryDto } from "./dto/menu-photos-query.dto";

/** Brauzerda kichraytirilgan surat (~1280px JPEG) odatda 150–400 KB bo'ladi */
const MAX_MENU_PHOTO_BYTES = 700 * 1024;
/** Bitta ovqatga (masalan, tushlikka) bir kunda yuklanadigan suratlar soni */
const MAX_PHOTOS_PER_MEAL = 4;

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class NutritionService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(scope: TenantScope, dto: UpsertMenuEntryDto) {
    const branchId = requireKitchenWriteScope(scope);
    const date = toDateOnly(dto.date);
    return this.prisma.menuEntry.upsert({
      where: { branchId_date: { branchId, date } },
      create: { branchId, date, breakfast: dto.breakfast, lunch: dto.lunch, snack: dto.snack },
      update: { breakfast: dto.breakfast, lunch: dto.lunch, snack: dto.snack },
    });
  }

  async findRange(scope: TenantScope, query: MenuQueryDto) {
    const branchId = scope.branchId ?? query.branchId;
    if (!branchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: scope.organizationId } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    return this.prisma.menuEntry.findMany({
      where: { branchId, date: { gte: toDateOnly(query.from), lte: toDateOnly(query.to) } },
      orderBy: { date: "asc" },
    });
  }

  /** Filial tashkilotga tegishli ekanini va foydalanuvchi uni ko'ra olishini tekshiradi */
  private async resolveReadableBranch(scope: TenantScope, requested?: string): Promise<string> {
    const branchId = scope.branchId ?? requested;
    if (!branchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    return branch.id;
  }

  /** Kun bo'yicha taom suratlari ro'yxati (suratning o'zi alohida so'raladi) */
  async listPhotos(scope: TenantScope, query: MenuPhotosQueryDto) {
    const branchId = await this.resolveReadableBranch(scope, query.branchId);
    return this.prisma.menuPhoto.findMany({
      where: { branchId, date: toDateOnly(query.date) },
      select: { id: true, meal: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Oshpaz (yoki filial admini/administrator) tayyor ovqatni suratga olib
   * yuklaydi. Surat ota-ona kabinetida o'sha kunning menyusi ostida ko'rinadi.
   */
  async uploadPhoto(scope: TenantScope, dto: UploadMenuPhotoDto) {
    const branchId = requireKitchenWriteScope(scope);
    const date = toDateOnly(dto.date.slice(0, 10));

    const [header, base64] = dto.image.split(",", 2);
    const mimeType = header.slice("data:".length, header.indexOf(";"));
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength === 0) {
      throw new BadRequestException("Rasm bo'sh");
    }
    if (buffer.byteLength > MAX_MENU_PHOTO_BYTES) {
      throw new BadRequestException("Rasm hajmi juda katta");
    }

    const existing = await this.prisma.menuPhoto.count({ where: { branchId, date, meal: dto.meal } });
    if (existing >= MAX_PHOTOS_PER_MEAL) {
      throw new BadRequestException(`Bitta ovqatga ${MAX_PHOTOS_PER_MEAL} tagacha rasm yuklash mumkin`);
    }

    return this.prisma.menuPhoto.create({
      data: { branchId, date, meal: dto.meal, image: buffer, mimeType, uploadedById: scope.userId },
      select: { id: true, meal: true, createdAt: true },
    });
  }

  async deletePhoto(scope: TenantScope, id: string) {
    const branchId = requireKitchenWriteScope(scope);
    const photo = await this.prisma.menuPhoto.findFirst({ where: { id, branchId }, select: { id: true } });
    if (!photo) {
      throw new NotFoundException("Rasm topilmadi");
    }
    await this.prisma.menuPhoto.delete({ where: { id: photo.id } });
    return { id: photo.id };
  }

  async readPhoto(scope: TenantScope, id: string) {
    const photo = await this.prisma.menuPhoto.findFirst({
      where: {
        id,
        branch: { organizationId: scope.organizationId },
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
      select: { image: true, mimeType: true },
    });
    if (!photo) {
      throw new NotFoundException("Rasm topilmadi");
    }
    return photo;
  }

  /**
   * Bugungi ovqat uchun bolalar soni: tarbiyachilar belgilagan davomatdan olinadi.
   * Ovqat "keldi" va "kechikdi" bolalarga tayyorlanadi; hali davomat qilinmagan
   * guruhlar alohida ko'rsatiladi — oshpaz raqam hali to'liq emasligini bilsin.
   */
  async todaySummary(scope: TenantScope, query: { branchId?: string; date: string }) {
    const branchId = scope.branchId ?? query.branchId;
    if (!branchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: scope.organizationId } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "")) {
      throw new BadRequestException("Sana noto'g'ri (YYYY-MM-DD)");
    }
    const date = toDateOnly(query.date);
    const [groups, children, attendances, employees, staffAttendances] = await Promise.all([
      this.prisma.group.findMany({ where: { branchId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      this.prisma.child.findMany({ where: { branchId, status: "ACTIVE" }, select: { id: true, groupId: true } }),
      this.prisma.attendance.findMany({ where: { branchId, date }, select: { childId: true, status: true } }),
      this.prisma.employee.findMany({ where: { branchId, isActive: true }, select: { id: true } }),
      this.prisma.employeeAttendance.findMany({ where: { branchId, date }, select: { employeeId: true, status: true } }),
    ]);
    const statusByChild = new Map(attendances.map((a) => [a.childId, a.status]));
    const rows = groups.map((g) => ({ groupId: g.id as string | null, name: g.name, total: 0, present: 0, late: 0, absent: 0, sick: 0, notMarked: 0 }));
    const noGroup = { groupId: null as string | null, name: "Guruhsiz", total: 0, present: 0, late: 0, absent: 0, sick: 0, notMarked: 0 };
    const byId = new Map(rows.map((r) => [r.groupId, r]));
    for (const child of children) {
      const row = (child.groupId && byId.get(child.groupId)) || noGroup;
      row.total += 1;
      const status = statusByChild.get(child.id);
      if (status === "PRESENT") row.present += 1;
      else if (status === "LATE") row.late += 1;
      else if (status === "ABSENT") row.absent += 1;
      else if (status === "SICK") row.sick += 1;
      else row.notMarked += 1;
    }
    if (noGroup.total > 0) rows.push(noGroup);
    const sum = (key: "total" | "present" | "late" | "absent" | "sick" | "notMarked") => rows.reduce((acc, r) => acc + r[key], 0);

    // Xodimlar ham bog'chada ovqatlanadi: xodimlar davomatidan (kelgan +
    // kechikkan) olinadi. Kasal, ta'tildagi va kelmaganlar — "kelmagan".
    const staffStatus = new Map(staffAttendances.map((a) => [a.employeeId, a.status]));
    const staff = { total: employees.length, present: 0, late: 0, absent: 0, notMarked: 0 };
    for (const employee of employees) {
      const status = staffStatus.get(employee.id);
      if (status === "PRESENT") staff.present += 1;
      else if (status === "LATE") staff.late += 1;
      else if (status) staff.absent += 1;
      else staff.notMarked += 1;
    }
    const mealCount = sum("present") + sum("late");
    const staffMealCount = staff.present + staff.late;

    return {
      date: query.date,
      total: sum("total"),
      present: sum("present"),
      late: sum("late"),
      absent: sum("absent"),
      sick: sum("sick"),
      notMarked: sum("notMarked"),
      // Ovqat tayyorlanadigan bolalar: kelganlar va kechikkanlar.
      mealCount,
      staff,
      staffMealCount,
      // Jami porsiya: bolalar + xodimlar
      totalMealCount: mealCount + staffMealCount,
      groups: rows,
    };
  }
}
