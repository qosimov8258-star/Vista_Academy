import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { FaceIdService } from "./face-id.service";
import { CreateDeviceDto } from "./dto/create-device.dto";
import { UpdateDeviceDto } from "./dto/update-device.dto";
import { DeviceQueryDto } from "./dto/device-query.dto";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { UpdateEnrollmentDto } from "./dto/update-enrollment.dto";
import { EnrollmentQueryDto } from "./dto/enrollment-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Face ID")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/face-id")
export class FaceIdController {
  constructor(private readonly faceIdService: FaceIdService) {}

  @Get("devices")
  findDevices(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: DeviceQueryDto) {
    return this.faceIdService.findDevices(toTenantScope(user), query);
  }

  @Post("devices")
  createDevice(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateDeviceDto) {
    return this.faceIdService.createDevice(toTenantScope(user), dto);
  }

  @Patch("devices/:id")
  updateDevice(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.faceIdService.updateDevice(toTenantScope(user), id, dto);
  }

  @Delete("devices/:id")
  removeDevice(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.faceIdService.removeDevice(toTenantScope(user), id);
  }

  @Get("enrollments")
  findEnrollments(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: EnrollmentQueryDto) {
    return this.faceIdService.findEnrollments(toTenantScope(user), query);
  }

  @Post("enrollments")
  createEnrollment(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateEnrollmentDto) {
    return this.faceIdService.createEnrollment(toTenantScope(user), dto);
  }

  @Patch("enrollments/:id")
  updateEnrollment(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateEnrollmentDto,
  ) {
    return this.faceIdService.updateEnrollment(toTenantScope(user), id, dto);
  }

  @Delete("enrollments/:id")
  removeEnrollment(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.faceIdService.removeEnrollment(toTenantScope(user), id);
  }
}
