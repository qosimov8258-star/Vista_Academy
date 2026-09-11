import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { BillingService } from "./billing.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { BulkCreateInvoiceDto } from "./dto/bulk-create-invoice.dto";
import { InvoiceQueryDto } from "./dto/invoice-query.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { PaymentQueryDto } from "./dto/payment-query.dto";
import { FinanceChildrenQueryDto, FinanceSummaryQueryDto } from "./dto/finance-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Billing")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /** Tarmoq bo'ylab moliya jamlanmasi: filial va guruh kesimida. */
  @Get("finance/summary")
  financeSummary(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: FinanceSummaryQueryDto) {
    return this.billingService.networkSummary(toTenantScope(user), query);
  }

  /** Bola kesimida to'lov holati: kim to'lagan, kim to'lamagan. */
  @Get("finance/children")
  financeChildren(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: FinanceChildrenQueryDto) {
    return this.billingService.networkChildren(toTenantScope(user), query);
  }

  @Get("invoices")
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: InvoiceQueryDto) {
    return this.billingService.findAll(toTenantScope(user), query);
  }

  @Post("invoices")
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.billingService.create(user, dto);
  }

  /** Guruh yoki butun filial bo'yicha bir xil summada ommaviy hisob-faktura. */
  @Post("invoices/bulk")
  bulkCreate(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: BulkCreateInvoiceDto) {
    return this.billingService.bulkCreate(user, dto);
  }

  @Get("payments")
  findPayments(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: PaymentQueryDto) {
    return this.billingService.findPayments(toTenantScope(user), query);
  }

  @Post("payments")
  recordPayment(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: RecordPaymentDto) {
    return this.billingService.recordPayment(user, dto);
  }

  @Post("payments/:id/refund")
  refundPayment(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.billingService.refundPayment(user, id);
  }

  @Get("children/:id/ledger")
  childLedger(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.billingService.childLedger(toTenantScope(user), id);
  }
}
