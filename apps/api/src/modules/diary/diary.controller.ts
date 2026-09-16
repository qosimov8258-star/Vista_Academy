import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseFilters,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { memoryStorage } from "multer";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { DIARY_LIMITS } from "./diary.constants";
import { DiaryUploadFilter } from "./diary-upload.filter";
import { DiaryService } from "./diary.service";
import { MarkEntryDto, UpdateEntryDto } from "./dto/mark-entry.dto";
import { DaysQueryDto, UpdateMediaDto, UploadMediaDto } from "./dto/media.dto";
import { ReplaceRoutineDto } from "./dto/replace-routine.dto";

const author = (user: TenantAuthenticatedUser) => ({ id: user.id, fullName: user.fullName });

/**
 * Kundalik — tarbiyachi paneli uchun. Ota-ona tomoni: `ParentDiaryController`
 * (`/app/parent/children/:childId/diary*`). To'liq tavsif: docs/kundalik-api.md.
 */
@ApiBearerAuth()
@ApiTags("Tenant Diary")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/diary")
export class DiaryController {
  constructor(private readonly diaryService: DiaryService) {}

  @Get("groups/:groupId/routine")
  getRoutine(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("groupId", ParseUUIDPipe) groupId: string) {
    return this.diaryService.getRoutine(toTenantScope(user), groupId);
  }

  @Put("groups/:groupId/routine")
  replaceRoutine(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("groupId", ParseUUIDPipe) groupId: string,
    @Body() dto: ReplaceRoutineDto,
  ) {
    return this.diaryService.replaceRoutine(toTenantScope(user), groupId, dto);
  }

  @Get("groups/:groupId/days")
  listDays(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("groupId", ParseUUIDPipe) groupId: string,
    @Query() query: DaysQueryDto,
  ) {
    return this.diaryService.listDays(toTenantScope(user), groupId, query.from, query.to);
  }

  @Get("groups/:groupId/days/:date")
  getDay(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("groupId", ParseUUIDPipe) groupId: string,
    @Param("date") date: string,
  ) {
    return this.diaryService.getDay(toTenantScope(user), groupId, date);
  }

  @Post("groups/:groupId/days/:date/entries")
  markEntry(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("groupId", ParseUUIDPipe) groupId: string,
    @Param("date") date: string,
    @Body() dto: MarkEntryDto,
  ) {
    return this.diaryService.markEntry(toTenantScope(user), author(user), groupId, date, dto);
  }

  @Patch("entries/:id")
  updateEntry(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateEntryDto,
  ) {
    return this.diaryService.updateEntry(toTenantScope(user), id, dto);
  }

  @Delete("entries/:id")
  deleteEntry(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.diaryService.deleteEntry(toTenantScope(user), id);
  }

  @Post("groups/:groupId/days/:date/media")
  @ApiConsumes("multipart/form-data")
  @UseFilters(DiaryUploadFilter)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "file", maxCount: 1 },
        { name: "poster", maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        // Eng katta ruxsat etilgan hajm; turiga qarab aniq chegara xizmatda
        limits: { fileSize: DIARY_LIMITS.videoMaxBytes, files: 2, fields: 10 },
      },
    ),
  )
  addMedia(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("groupId", ParseUUIDPipe) groupId: string,
    @Param("date") date: string,
    @UploadedFiles() files: { file?: Express.Multer.File[]; poster?: Express.Multer.File[] },
    @Body() dto: UploadMediaDto,
  ) {
    return this.diaryService.addMedia(toTenantScope(user), author(user), groupId, date, files ?? {}, dto);
  }

  @Patch("media/:id")
  updateMedia(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.diaryService.updateMedia(toTenantScope(user), id, dto);
  }

  @Delete("media/:id")
  deleteMedia(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.diaryService.deleteMedia(toTenantScope(user), id);
  }

  @Get("media/:id/file")
  mediaFile(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.diaryService.sendMedia(toTenantScope(user), id, "file", req, res);
  }

  @Get("media/:id/poster")
  mediaPoster(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.diaryService.sendMedia(toTenantScope(user), id, "poster", req, res);
  }
}
