import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { WeeklyCoinAssessmentsService } from "./weekly-coin-assessments.service";
import { WeeklyAssessmentQuestionsQueryDto } from "./dto/weekly-assessment-questions-query.dto";
import { SubmitWeeklyAssessmentDto } from "./dto/submit-weekly-assessment.dto";

@ApiBearerAuth()
@ApiTags("Tenant Coins")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/coins")
export class WeeklyCoinAssessmentsController {
  constructor(private readonly weeklyCoinAssessmentsService: WeeklyCoinAssessmentsService) {}

  @Get("weekly-assessments/questions")
  listQuestions(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: WeeklyAssessmentQuestionsQueryDto) {
    return this.weeklyCoinAssessmentsService.listQuestions(toTenantScope(user), query.childId);
  }

  @Post("weekly-assessments")
  submit(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: SubmitWeeklyAssessmentDto) {
    return this.weeklyCoinAssessmentsService.submit(toTenantScope(user), dto);
  }

  @Get("children/:childId/weekly-assessments")
  history(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("childId") childId: string) {
    return this.weeklyCoinAssessmentsService.history(toTenantScope(user), childId);
  }
}
