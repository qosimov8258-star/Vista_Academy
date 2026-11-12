import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { sendMediaResponse } from "../../common/media-response";
import { R2Service } from "../storage/r2.service";
import { UpdateGroupAvatarDto } from "./dto/update-group-avatar.dto";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { DenyCallOperator } from "../iam/decorators/deny-call-operator.decorator";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { GroupsService } from "./groups.service";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import { GroupQueryDto } from "./dto/group-query.dto";
import { GroupAttendanceQueryDto } from "./dto/group-attendance-query.dto";
import { GroupDayQueryDto } from "./dto/group-day-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Groups")
@Public()
@UseGuards(TenantJwtAuthGuard)
@DenyCallOperator()
@Controller("app/groups")
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly r2: R2Service,
  ) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: GroupQueryDto) {
    return this.groupsService.findAll(toTenantScope(user), query);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user, dto);
  }

  @Get(":id")
  findOne(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.groupsService.findOne(toTenantScope(user), id);
  }

  @Patch(":id")
  update(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(user, id, dto);
  }

  /** Guruh rasmini (profil belgisi) yuklash. */
  @Put(":id/avatar")
  updateAvatar(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateGroupAvatarDto,
  ) {
    return this.groupsService.updateAvatar(user, id, dto);
  }

  @Delete(":id/avatar")
  removeAvatar(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.groupsService.removeAvatar(user, id);
  }

  /**
   * Rasmni binar ko'rinishda qaytaradi. `<img src>` shu manzilni ishlatadi,
   * shuning uchun javob umumiy `{ success, data }` qobig'iga o'ralmaydi.
   */
  @Get(":id/avatar")
  @Header("Cache-Control", "private, max-age=60")
  async readAvatar(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const record = await this.groupsService.readAvatar(toTenantScope(user), id);
    await sendMediaResponse(
      res,
      this.r2,
      { key: record.avatarKey, bytes: record.avatar, mimeType: record.avatarMimeType ?? "image/jpeg" },
      "Guruh rasmi yo'q",
    );
  }

  /** Guruh kartochkasi: tarbiyachilar, bolalar ro'yxati va jins taqsimoti. */
  @Get(":id/overview")
  overview(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.groupsService.overview(toTenantScope(user), id);
  }

  /** Bitta kunning nomli ro'yxati: kim keldi, kim kelmadi, kim belgilanmagan. */
  @Get(":id/attendance/day")
  attendanceDay(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Query() query: GroupDayQueryDto,
  ) {
    return this.groupsService.attendanceDay(toTenantScope(user), id, query);
  }

  /** Sana oralig'idagi davomat: kunlik yig'indi va bola kesimidagi hisob. */
  @Get(":id/attendance")
  attendance(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Query() query: GroupAttendanceQueryDto,
  ) {
    return this.groupsService.attendanceRange(toTenantScope(user), id, query);
  }
}
