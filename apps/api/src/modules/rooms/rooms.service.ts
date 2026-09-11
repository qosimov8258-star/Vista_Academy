import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { CreateRoomDto } from "./dto/create-room.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";
import { RoomQueryDto } from "./dto/room-query.dto";

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ko'rish — istalgan tizim foydalanuvchisi, filial bo'yicha. */
  async findAll(scope: TenantScope, query: RoomQueryDto) {
    const branchId = scope.branchId ?? query.branchId;
    if (scope.branchId && query.branchId && query.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu filialga kirish huquqingiz yo'q");
    }
    if (!branchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: scope.organizationId } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    return this.prisma.room.findMany({ where: { branchId }, orderBy: { name: "asc" } });
  }

  /** Yozish — faqat filial admini va administrator (`requireOperationalScope`). */
  async create(scope: TenantScope, dto: CreateRoomDto) {
    const branchId = requireOperationalScope(scope);
    try {
      return await this.prisma.room.create({ data: { branchId, name: dto.name.trim() } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu nom bilan xona allaqachon mavjud");
      }
      throw err;
    }
  }

  async update(scope: TenantScope, id: string, dto: UpdateRoomDto) {
    const branchId = requireOperationalScope(scope);
    const room = await this.prisma.room.findFirst({ where: { id, branchId } });
    if (!room) {
      throw new NotFoundException("Xona topilmadi");
    }
    try {
      return await this.prisma.room.update({ where: { id }, data: { name: dto.name?.trim() } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu nom bilan xona allaqachon mavjud");
      }
      throw err;
    }
  }

  /**
   * O'chirish shu xonadagi barcha dars jadvali qatorlarini ham olib tashlaydi
   * (schema'da `onDelete: Cascade`) — admin bilib turib o'chiradi.
   */
  async remove(scope: TenantScope, id: string) {
    const branchId = requireOperationalScope(scope);
    const room = await this.prisma.room.findFirst({ where: { id, branchId } });
    if (!room) {
      throw new NotFoundException("Xona topilmadi");
    }
    await this.prisma.room.delete({ where: { id } });
    return { id };
  }
}
