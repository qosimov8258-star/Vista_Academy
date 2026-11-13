import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { ParentEngagementService } from "./parent-engagement.service";
import { ParentEntryService } from "../parent/parent-entry.service";

/**
 * «Ota-onalar» bo'limi: ota-onalar kabinetdan qanchalik foydalanayotgani.
 * Super Admin, filial admini va administrator ko'radi; filial xodimi —
 * faqat o'z filiali. Super Admin `branchId` bilan bitta filialni tanlaydi.
 */
@ApiBearerAuth()
@ApiTags("Parent Engagement")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/parent-engagement")
export class ParentEngagementController {
  constructor(
    private readonly service: ParentEngagementService,
    private readonly entryService: ParentEntryService,
  ) {}

  @Get()
  overview(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("branchId") branchId?: string) {
    return this.service.overview(user, branchId);
  }

  /** Excel hisobot (oxirgi 30 kun) — ekrandagi ma'lumot bilan bir xil */
  @Get("report")
  async report(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("branchId") branchId: string | undefined, @Res() res: Response) {
    const file = await this.service.report(user, branchId);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(file.buffer);
  }

  /** «Ota-ona profiliga kirish» — kabinetga bir martalik chipta (Super Admin, filial admini) */
  @Post(":guardianId/enter")
  @HttpCode(HttpStatus.OK)
  enter(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("guardianId", ParseUUIDPipe) guardianId: string) {
    return this.entryService.issueTicket(user, guardianId);
  }

  @Get(":guardianId")
  detail(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("guardianId", ParseUUIDPipe) guardianId: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.service.detail(user, guardianId, branchId);
  }
}
