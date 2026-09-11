import { Controller, Get, Param, Query, Res, UseGuards } from "@nestjs/common";
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

  @Get("leads")
  async leads(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query("branchId") branchId: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.leadsCsv(toTenantScope(user), branchId);
    sendCsv(res, "arizalar.csv", csv);
  }

  @Get("invoices/:id/pdf")
  async invoicePdf(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const pdf = await this.exportsService.invoicePdf(toTenantScope(user), id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="hisob-faktura-${id}.pdf"`);
    res.send(pdf);
  }

  @Get("payments/:id/pdf")
  async paymentReceiptPdf(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const pdf = await this.exportsService.paymentReceiptPdf(toTenantScope(user), id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="tolov-kvitansiyasi-${id}.pdf"`);
    res.send(pdf);
  }

  @Get("attendance")
  async attendance(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query("date") date: string,
    @Query("branchId") branchId: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.attendanceCsv(toTenantScope(user), date, branchId, from, to);
    sendCsv(res, from && to ? `davomat-${from}_${to}.csv` : `davomat-${date}.csv`, csv);
  }

  @Get("menu")
  async menu(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("branchId") branchId: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.exportsService.menuCsv(toTenantScope(user), from, to, branchId);
    sendCsv(res, `menyu-${from}_${to}.csv`, csv);
  }
}
