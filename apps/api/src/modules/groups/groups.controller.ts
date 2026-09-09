import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { GroupsService } from "./groups.service";
import { CreateGroupDto } from "./dto/create-group.dto";
import { GroupQueryDto } from "./dto/group-query.dto";
import { GroupAttendanceQueryDto } from "./dto/group-attendance-query.dto";
import { GroupDayQueryDto } from "./dto/group-day-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Groups")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/groups")
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: GroupQueryDto) {
    return this.groupsService.findAll(toTenantScope(user), query);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(toTenantScope(user), dto);
  }

  @Get(":id")
  findOne(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.groupsService.findOne(toTenantScope(user), id);
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
