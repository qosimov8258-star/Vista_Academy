import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { DiscountsService } from "./discounts.service";
import { BulkCreateDiscountDto, CreateDiscountDto, DiscountQueryDto, UpdateDiscountDto } from "./dto/discount.dto";

@ApiBearerAuth()
@ApiTags("Tenant Discounts")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/discounts")
export class DiscountsController {
  constructor(private readonly service: DiscountsService) {}

  /** Oy bo'yicha: jami chegirma, guruhlar kesimi, bolalar ro'yxati */
  @Get()
  dashboard(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: DiscountQueryDto) {
    return this.service.dashboard(user, query);
  }

  /** "Tez chegirma": oila a'zolari (umumiy ota-ona/telefon yoki familiya) */
  @Get("suggestions")
  suggestions(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: DiscountQueryDto) {
    return this.service.suggestions(user, query);
  }

  /** Bolaning chegirmalari tarixi va joriy oydagi natija */
  @Get("child/:childId")
  forChild(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("childId") childId: string) {
    return this.service.forChild(user, childId);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateDiscountDto) {
    return this.service.create(user, dto);
  }

  @Post("bulk")
  bulkCreate(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: BulkCreateDiscountDto) {
    return this.service.bulkCreate(user, dto);
  }

  @Patch(":id")
  update(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateDiscountDto) {
    return this.service.update(user, id, dto);
  }

  /** To'xtatish — o'chirilmaydi, tarixda qoladi */
  @Delete(":id")
  end(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.service.end(user, id);
  }
}
