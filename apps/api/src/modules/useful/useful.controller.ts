import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { UsefulService } from "./useful.service";
import { UsefulQueryDto } from "./dto/useful-query.dto";
import { CreatePoemDto } from "./dto/create-poem.dto";
import { UpdatePoemDto } from "./dto/update-poem.dto";
import { CreateProverbDto } from "./dto/create-proverb.dto";
import { UpdateProverbDto } from "./dto/update-proverb.dto";
import { CreateTaleDto } from "./dto/create-tale.dto";
import { UpdateTaleDto } from "./dto/update-tale.dto";

/**
 * "Foydali" bo'limi — tarbiyachi paneli. She'r/maqol/ertak qo'shish, ko'rish,
 * tahrirlash, o'chirish. Ota-ona faqat o'qiydi (qarang: `ParentUsefulController`).
 */
@ApiBearerAuth()
@ApiTags("Tenant Useful Content")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/useful")
export class UsefulController {
  constructor(private readonly usefulService: UsefulService) {}

  // ---------------- Poems ----------------

  @Get("poems")
  findPoems(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: UsefulQueryDto) {
    return this.usefulService.findPoems(toTenantScope(user), query);
  }

  @Post("poems")
  createPoem(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreatePoemDto) {
    return this.usefulService.createPoem(toTenantScope(user), dto);
  }

  @Get("poems/:id")
  findPoem(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.usefulService.findPoem(toTenantScope(user), id);
  }

  @Patch("poems/:id")
  updatePoem(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: UpdatePoemDto) {
    return this.usefulService.updatePoem(toTenantScope(user), id, dto);
  }

  @Delete("poems/:id")
  removePoem(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.usefulService.removePoem(toTenantScope(user), id);
  }

  // ---------------- Proverbs ----------------

  @Get("proverbs")
  findProverbs(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: UsefulQueryDto) {
    return this.usefulService.findProverbs(toTenantScope(user), query);
  }

  @Post("proverbs")
  createProverb(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateProverbDto) {
    return this.usefulService.createProverb(toTenantScope(user), dto);
  }

  @Get("proverbs/:id")
  findProverb(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.usefulService.findProverb(toTenantScope(user), id);
  }

  @Patch("proverbs/:id")
  updateProverb(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateProverbDto) {
    return this.usefulService.updateProverb(toTenantScope(user), id, dto);
  }

  @Delete("proverbs/:id")
  removeProverb(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.usefulService.removeProverb(toTenantScope(user), id);
  }

  // ---------------- Tales ----------------

  @Get("tales")
  findTales(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: UsefulQueryDto) {
    return this.usefulService.findTales(toTenantScope(user), query);
  }

  @Post("tales")
  createTale(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateTaleDto) {
    return this.usefulService.createTale(toTenantScope(user), dto);
  }

  @Get("tales/:id")
  findTale(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.usefulService.findTale(toTenantScope(user), id);
  }

  @Patch("tales/:id")
  updateTale(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateTaleDto) {
    return this.usefulService.updateTale(toTenantScope(user), id, dto);
  }

  @Delete("tales/:id")
  removeTale(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.usefulService.removeTale(toTenantScope(user), id);
  }
}
