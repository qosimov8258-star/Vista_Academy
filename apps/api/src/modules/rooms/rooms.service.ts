import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { CreateRoomDto, RoomQueryDto, UpdateRoomDto } from "./dto/room.dto";

const roomSelect = {
  id: true,
  branchId: true,
  name: true,
  capacity: true,
  isActive: true,
  _count: { select: { lessonSchedules: true } },
} satisfies Prisma.RoomSelect;

/**
 * Xonalar (kabinetlar) — filial bo'yicha. Ro'yxatni filialdagi hamma ko'radi
 * (o'qituvchi darsi qaysi xonada ekanini bilsin), o'zgartirish — filial
 * admini va administrator.
 */
@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(scope: TenantScope, query: RoomQueryDto) {
    const branchId = scope.branchId ?? query.branchId;
    if (scope.branchId && query.branchId && query.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu filialga kirish huquqingiz yo'q");
    }
    if (!branchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: scope.organizationId }, select: { id: true } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    const rooms = await this.prisma.room.findMany({ where: { branchId }, select: roomSelect, orderBy: { name: "asc" } });
    // "2-xona" "10-xona"dan oldin — nomdagi raqamlar son sifatida taqqoslanadi
    return rooms
      .sort((a, b) => a.name.localeCompare(b.name, "uz", { numeric: true }))
      .map(({ _count, ...room }) => ({ ...room, lessonCount: _count.lessonSchedules }));
  }

  async create(scope: TenantScope, dto: CreateRoomDto) {
    const branchId = requireOperationalScope(scope);
    try {
      const { _count, ...room } = await this.prisma.room.create({
        data: { branchId, name: dto.name, capacity: dto.capacity ?? null },
        select: roomSelect,
      });
      return { ...room, lessonCount: _count.lessonSchedules };
    } catch (err) {
      throw translateDuplicate(err);
    }
  }

  async update(scope: TenantScope, id: string, dto: UpdateRoomDto) {
    const branchId = requireOperationalScope(scope);
    await this.findOwn(branchId, id);
    try {
      const { _count, ...room } = await this.prisma.room.update({
        where: { id },
        data: { name: dto.name, capacity: dto.capacity, isActive: dto.isActive },
        select: roomSelect,
      });
      return { ...room, lessonCount: _count.lessonSchedules };
    } catch (err) {
      throw translateDuplicate(err);
    }
  }

  /** Xona o'chiriladi, uning darslari o'chmaydi — xonasiz qoladi (SET NULL). */
  async remove(scope: TenantScope, id: string) {
    const branchId = requireOperationalScope(scope);
    await this.findOwn(branchId, id);
    const released = await this.prisma.lessonSchedule.count({ where: { roomId: id } });
    await this.prisma.room.delete({ where: { id } });
    return { id, released };
  }

  private async findOwn(branchId: string, id: string) {
    const room = await this.prisma.room.findFirst({ where: { id, branchId }, select: { id: true } });
    if (!room) {
      throw new NotFoundException("Xona topilmadi");
    }
    return room;
  }
}

function translateDuplicate(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return new ConflictException("Bu filialda shu nomli xona allaqachon bor");
  }
  return err;
}
