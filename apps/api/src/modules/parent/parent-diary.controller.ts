import { Controller, Get, Param, ParseUUIDPipe, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentParent } from "./decorators/current-parent.decorator";
import { ParentJwtAuthGuard } from "./guards/parent-jwt-auth.guard";
import { AuthenticatedParent } from "./parent-auth.types";
import { ParentDiaryService } from "./parent-diary.service";

/** Ota-ona kabinetidagi "Kundalik" — faqat o'qish. */
@ApiTags("Parent Diary")
@Public()
@UseGuards(ParentJwtAuthGuard)
@Controller("app/parent")
export class ParentDiaryController {
  constructor(private readonly parentDiaryService: ParentDiaryService) {}

  /** Bir kunlik kundalik; `date` berilmasa — bugun */
  @Get("children/:childId/diary")
  day(
    @CurrentParent() parent: AuthenticatedParent,
    @Param("childId") childId: string,
    @Query("date") date?: string,
  ) {
    return this.parentDiaryService.day(parent, childId, date);
  }

  /** Oxirgi kunlar tasmasi (sukut — 14 kun, ko'pi bilan 31) */
  @Get("children/:childId/diary/days")
  days(
    @CurrentParent() parent: AuthenticatedParent,
    @Param("childId") childId: string,
    @Query("count") count?: string,
  ) {
    return this.parentDiaryService.recentDays(parent, childId, count ? Number(count) : undefined);
  }

  @Get("diary/media/:id/file")
  mediaFile(
    @CurrentParent() parent: AuthenticatedParent,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.parentDiaryService.sendMedia(parent, id, "file", req, res);
  }

  @Get("diary/media/:id/poster")
  mediaPoster(
    @CurrentParent() parent: AuthenticatedParent,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.parentDiaryService.sendMedia(parent, id, "poster", req, res);
  }
}
