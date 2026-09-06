import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { ExportsService } from "./exports.service";

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`﻿${csv}`);
}

@ApiBearerAuth()
@ApiTags("Tenant Exports")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/exports")
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get("children")
  async children(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query("branchId") branchId: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.childrenCsv(toTenantScope(user), branchId);
    sendCsv(res, "bolalar.csv", csv);
  }

  @Get("invoices")
  async invoices(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query("branchId") branchId: string | undefined,
    @Query("period") period: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.invoicesCsv(toTenantScope(user), branchId, period);
    sendCsv(res, "hisob-fakturalar.csv", csv);
  }

  @Get("attendance")
  async attendance(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query("date") date: string,
    @Query("branchId") branchId: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.attendanceCsv(toTenantScope(user), date, branchId);
    sendCsv(res, `davomat-${date}.csv`, csv);
  }
}
