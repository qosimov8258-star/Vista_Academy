import { Controller, Get, Header, Param, Post, Body, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { sendMediaResponse } from "../../common/media-response";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { R2Service } from "../storage/r2.service";
import { PaymentReceiptsService } from "./payment-receipts.service";
import { ApprovePaymentReceiptDto } from "./dto/approve-payment-receipt.dto";
import { RejectPaymentReceiptDto } from "./dto/reject-payment-receipt.dto";

/** Moliyachi tomoni — ota-ona yuklagan to'lov cheklarini ko'rib chiqish. */
@ApiBearerAuth()
@ApiTags("Tenant Payment Receipts")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app")
export class PaymentReceiptsController {
  constructor(
    private readonly paymentReceiptsService: PaymentReceiptsService,
    private readonly r2: R2Service,
  ) {}

  @Get("children/:childId/payment-receipts")
  listForChild(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("childId") childId: string) {
    return this.paymentReceiptsService.listForChild(toTenantScope(user), childId);
  }

  /** Chek suratini binar ko'rinishda qaytaradi — `<img src>` shu manzilni ishlatadi. */
  @Get("payment-receipts/:id/image")
  @Header("Cache-Control", "private, max-age=60")
  async image(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Res() res: Response) {
    const record = await this.paymentReceiptsService.readImageForStaff(toTenantScope(user), id);
    await sendMediaResponse(
      res,
      this.r2,
      { key: record.imageKey, bytes: record.image, mimeType: record.mimeType },
      "Chek surati yo'q",
    );
  }

  @Post("payment-receipts/:id/approve")
  approve(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ApprovePaymentReceiptDto,
  ) {
    return this.paymentReceiptsService.approve(user, id, dto);
  }

  @Post("payment-receipts/:id/reject")
  reject(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RejectPaymentReceiptDto,
  ) {
    return this.paymentReceiptsService.reject(user, id, dto);
  }
}
