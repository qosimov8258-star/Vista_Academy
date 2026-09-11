import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { LessonTopicsService } from "./lesson-topics.service";
import { CreateLessonTopicDto } from "./dto/create-lesson-topic.dto";
import { UpdateLessonTopicDto } from "./dto/update-lesson-topic.dto";
import { LessonTopicQueryDto } from "./dto/lesson-topic-query.dto";
import { CreateTopicQuestionDto } from "./dto/create-topic-question.dto";
import { UpdateTopicQuestionDto } from "./dto/update-topic-question.dto";

@ApiBearerAuth()
@ApiTags("Tenant Lesson Topics")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/lesson-topics")
export class LessonTopicsController {
  constructor(private readonly lessonTopicsService: LessonTopicsService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: LessonTopicQueryDto) {
    return this.lessonTopicsService.findAll(toTenantScope(user), query);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateLessonTopicDto) {
    return this.lessonTopicsService.create(toTenantScope(user), dto);
  }

  @Get(":id")
  findOne(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.lessonTopicsService.findOne(toTenantScope(user), id);
  }

  @Patch(":id")
  update(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateLessonTopicDto) {
    return this.lessonTopicsService.update(toTenantScope(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.lessonTopicsService.remove(toTenantScope(user), id);
  }

  @Post(":id/questions")
  addQuestion(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: CreateTopicQuestionDto) {
    return this.lessonTopicsService.addQuestion(toTenantScope(user), id, dto);
  }

  @Patch("questions/:questionId")
  updateQuestion(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("questionId") questionId: string,
    @Body() dto: UpdateTopicQuestionDto,
  ) {
    return this.lessonTopicsService.updateQuestion(toTenantScope(user), questionId, dto);
  }

  @Delete("questions/:questionId")
  removeQuestion(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("questionId") questionId: string) {
    return this.lessonTopicsService.removeQuestion(toTenantScope(user), questionId);
  }
}
