import { Body, Controller, Delete, Get, Header, NotFoundException, Param, Patch, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { ProductsService } from "./products.service";
import { ProductsQueryDto } from "./dto/products-query.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { UpdateProductImageDto } from "./dto/update-product-image.dto";
import { SellProductDto } from "./dto/sell-product.dto";

@ApiBearerAuth()
@ApiTags("Tenant Products")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: ProductsQueryDto) {
    return this.productsService.findAll(toTenantScope(user), query);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(toTenantScope(user), dto);
  }

  @Patch(":id")
  update(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(toTenantScope(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.productsService.remove(toTenantScope(user), id);
  }

  @Put(":id/images/:position")
  updateImage(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Param("position") position: string,
    @Body() dto: UpdateProductImageDto,
  ) {
    return this.productsService.updateImage(toTenantScope(user), id, position, dto);
  }

  @Delete(":id/images/:position")
  removeImage(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Param("position") position: string,
  ) {
    return this.productsService.removeImage(toTenantScope(user), id, position);
  }

  /**
   * Rasmni binar ko'rinishda qaytaradi. `<img src>` shu manzilni ishlatadi,
   * shuning uchun javob umumiy `{ success, data }` qobig'iga o'ralmaydi.
   */
  @Get(":id/images/:position")
  @Header("Cache-Control", "private, max-age=60")
  async readImage(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Param("position") position: string,
    @Res() res: Response,
  ) {
    const record = await this.productsService.readImage(toTenantScope(user), id, position);
    if (!record.image) {
      throw new NotFoundException("Bu rasm o'rni bo'sh");
    }
    res.setHeader("Content-Type", record.mimeType ?? "image/jpeg");
    res.send(Buffer.from(record.image));
  }

  @Post(":id/sell")
  sell(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: SellProductDto,
  ) {
    return this.productsService.sell(toTenantScope(user), id, dto);
  }
}
