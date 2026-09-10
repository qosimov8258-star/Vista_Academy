import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { SubjectsService } from "./subjects.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";

@ApiBearerAuth()
@ApiTags("Tenant Subjects")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/subjects")
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.subjectsService.findAll(toTenantScope(user));
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateSubjectDto) {
    return this.subjectsService.create(toTenantScope(user), dto);
  }
}
