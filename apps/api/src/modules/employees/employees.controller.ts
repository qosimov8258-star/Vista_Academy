import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { EmployeesService } from "./employees.service";
import { CreateEmployeeDto, EmployeeAccountDto } from "./dto/create-employee.dto";
import { UpdateEmployeeGroupsDto } from "./dto/update-employee-groups.dto";
import { UpdateEmployeeAvatarDto } from "./dto/update-employee-avatar.dto";
import { EmployeeQueryDto } from "./dto/employee-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Employees")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/employees")
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: EmployeeQueryDto) {
    return this.employeesService.findAll(toTenantScope(user), query);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(toTenantScope(user), dto);
  }

  @Post(":id/account")
  openAccount(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: EmployeeAccountDto,
  ) {
    return this.employeesService.openAccount(toTenantScope(user), id, dto);
  }

  @Patch(":id/groups")
  updateGroups(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeGroupsDto,
  ) {
    return this.employeesService.updateGroups(toTenantScope(user), id, dto);
  }

  /** Xodimga yangi (avtomatik generatsiya qilingan) parol beradi — bir martalik javobda qaytadi. */
  @Post(":id/password/regenerate")
  regeneratePassword(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.employeesService.regeneratePassword(toTenantScope(user), id);
  }

  /**
   * Xodim kabineti parolini ko'rsatadi. `X-Reveal-Token` — admin qurilmasi
   * WebAuthn bilan tasdiqlangandan keyin `/app/webauthn/authentication/verify`
   * dan olinadigan qisqa umrli token.
   */
  @Get(":id/password")
  revealPassword(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Headers("x-reveal-token") revealToken?: string,
  ) {
    if (!revealToken) {
      throw new BadRequestException("Reveal token kerak");
    }
    return this.employeesService.revealPassword(toTenantScope(user), id, revealToken);
  }

  /** Xodim suratini yuklash. */
  @Put(":id/avatar")
  updateAvatar(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeAvatarDto,
  ) {
    return this.employeesService.updateAvatar(toTenantScope(user), id, dto);
  }

  @Delete(":id/avatar")
  removeAvatar(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.employeesService.removeAvatar(toTenantScope(user), id);
  }

  /**
   * Xodimni butunlay o'chiradi. `X-Reveal-Token` — admin qurilmasi WebAuthn
   * bilan tasdiqlangandan keyin `/app/webauthn/authentication/verify` dan
   * olinadigan qisqa umrli token (parolni ko'rsatishdagi bilan bir xil).
   */
  @Delete(":id")
  remove(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Headers("x-reveal-token") revealToken?: string,
  ) {
    if (!revealToken) {
      throw new BadRequestException("Reveal token kerak");
    }
    return this.employeesService.remove(toTenantScope(user), id, revealToken);
  }

  /**
   * Suratni binar ko'rinishda qaytaradi. `<img src>` shu manzilni ishlatadi,
   * shuning uchun javob umumiy `{ success, data }` qobig'iga o'ralmaydi.
   */
  @Get(":id/avatar")
  @Header("Cache-Control", "private, max-age=60")
  async readAvatar(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const record = await this.employeesService.readAvatar(toTenantScope(user), id);
    if (!record.avatar) {
      throw new NotFoundException("Xodimning surati yo'q");
    }
    res.setHeader("Content-Type", record.avatarMimeType ?? "image/jpeg");
    res.send(Buffer.from(record.avatar));
  }
}
