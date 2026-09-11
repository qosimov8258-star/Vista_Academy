import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { CreateDishDto } from "./dto/create-dish.dto";
import { UpdateDishDto } from "./dto/update-dish.dto";

@Injectable()
export class DishesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(scope: TenantScope) {
    return this.prisma.dish.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: { name: "asc" },
    });
  }

  async create(scope: TenantScope, dto: CreateDishDto) {
    requireOperationalScope(scope);
    try {
      return await this.prisma.dish.create({
        data: {
          organizationId: scope.organizationId,
          name: dto.name.trim(),
          calories: dto.calories,
          allergens: dto.allergens,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu taom allaqachon katalogda bor");
      }
      throw err;
    }
  }

  async update(scope: TenantScope, id: string, dto: UpdateDishDto) {
    requireOperationalScope(scope);
    await this.requireDish(scope, id);
    try {
      return await this.prisma.dish.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          calories: dto.calories === null ? null : dto.calories,
          allergens: dto.allergens === null ? null : dto.allergens,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu taom allaqachon katalogda bor");
      }
      throw err;
    }
  }

  async remove(scope: TenantScope, id: string) {
    requireOperationalScope(scope);
    await this.requireDish(scope, id);
    await this.prisma.dish.delete({ where: { id } });
    return { id };
  }

  private async requireDish(scope: TenantScope, id: string) {
    const dish = await this.prisma.dish.findFirst({ where: { id, organizationId: scope.organizationId } });
    if (!dish) {
      throw new NotFoundException("Taom topilmadi");
    }
    return dish;
  }
}
