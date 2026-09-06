import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { ChildHealthService } from "./child-health.service";
import { UpsertHealthProfileDto } from "./dto/upsert-health-profile.dto";
import { CreateVaccinationDto } from "./dto/create-vaccination.dto";
import { UpdateVaccinationDto } from "./dto/update-vaccination.dto";
import { CreateMedicationLogDto } from "./dto/create-medication-log.dto";
import { SetQuarantineDto } from "./dto/quarantine.dto";

@ApiBearerAuth()
@ApiTags("Tenant Child Health")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app")
export class ChildHealthController {
  constructor(private readonly childHealthService: ChildHealthService) {}

  @Get("children/:id/health")
  getProfile(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.childHealthService.getProfile(toTenantScope(user), id);
  }

  @Post("children/:id/health")
  upsertProfile(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: UpsertHealthProfileDto) {
    return this.childHealthService.upsertProfile(toTenantScope(user), id, dto);
  }

  @Get("children/:id/vaccinations")
  listVaccinations(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.childHealthService.listVaccinations(toTenantScope(user), id);
  }

  @Post("children/:id/vaccinations")
  createVaccination(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: CreateVaccinationDto) {
    return this.childHealthService.createVaccination(toTenantScope(user), id, dto);
  }

  @Patch("vaccinations/:id")
  updateVaccination(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateVaccinationDto) {
    return this.childHealthService.updateVaccination(toTenantScope(user), id, dto);
  }

  @Get("children/:id/medications")
  listMedications(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.childHealthService.listMedicationLogs(toTenantScope(user), id);
  }

  @Post("children/:id/medications")
  createMedication(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: CreateMedicationLogDto) {
    return this.childHealthService.createMedicationLog(user, id, dto);
  }

  @Post("children/:id/quarantine")
  setQuarantine(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: SetQuarantineDto) {
    return this.childHealthService.setQuarantine(toTenantScope(user), id, dto);
  }

  @Delete("children/:id/quarantine")
  clearQuarantine(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.childHealthService.clearQuarantine(toTenantScope(user), id);
  }
}
