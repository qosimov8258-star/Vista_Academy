import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DiscountScope, DiscountType, InvoiceStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { TenantAuthenticatedUser, TenantScope, requireMoneyScope, resolveReadBranchFilter, toTenantScope } from "../iam/tenant-auth.types";
import { monthlyFeeOf } from "../billing/monthly-fee";
import {
  HIGH_IMPACT_DISCOUNT,
  chooseDiscount,
  currentPeriod,
  discountAmountOf,
  discountInputError,
  discountScopeText,
  discountText,
  phoneKey,
  surnameKey,
} from "./discount-rules";
import { applyRuleChangeToInvoices, childRules, discountRuleSelect, type InvoiceDiscountChange } from "./discount-invoices";
import { BulkCreateDiscountDto, CreateDiscountDto, DiscountQueryDto, UpdateDiscountDto } from "./dto/discount.dto";

type Tx = Prisma.TransactionClient;

const ruleView = {
  ...discountRuleSelect,
  reason: true,
  createdByName: true,
  endedAt: true,
} satisfies Prisma.ChildDiscountSelect;

type RuleView = Prisma.ChildDiscountGetPayload<{ select: typeof ruleView }>;

const childSelect = {
  id: true,
  publicId: true,
  fullName: true,
  lastName: true,
  branchId: true,
  group: { select: { id: true, name: true, monthlyFee: true } },
  childDiscounts: { select: ruleView },
} satisfies Prisma.ChildSelect;

type ChildForDiscount = Prisma.ChildGetPayload<{ select: typeof childSelect }>;

/** Ekranga chiqadigan qator: oylik narx, chegirma va to'lanadigan summa */
export interface DiscountChildRow {
  childId: string;
  publicId: number;
  fullName: string;
  groupId: string | null;
  groupName: string | null;
  branchId: string;
  branchName: string;
  gross: number;
  discount: number;
  net: number;
  rate: number;
  invoiced: boolean;
  status: "NONE" | "ACTIVE" | "REVIEW";
  rule: ReturnType<typeof toRuleDto> | null;
}

function toRuleDto(rule: RuleView) {
  return {
    id: rule.id,
    type: rule.type,
    scope: rule.scope,
    value: Number(rule.value),
    startPeriod: rule.startPeriod,
    endPeriod: rule.endPeriod,
    reason: rule.reason,
    isActive: rule.isActive,
    createdByName: rule.createdByName,
    createdAt: rule.createdAt,
    endedAt: rule.endedAt,
  };
}

/**
 * Chegirmalar — Sabot ERP'dagi bo'limdan moslashtirilgan. Qoida bolaga
 * beriladi (bir oylik yoki doimiy; foiz, summa yoki yakuniy narx), oylik
 * hisob-fakturaning `discountAmount`i shu qoidadan olinadi.
 */
@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Oy bo'yicha umumiy ko'rinish: jami, guruhlar kesimi, bolalar ro'yxati */
  async dashboard(caller: TenantAuthenticatedUser, query: DiscountQueryDto) {
    const scope = toTenantScope(caller);
    assertDiscountReader(scope);
    const period = query.period ?? currentPeriod();
    const rows = await this.rows(scope, period, resolveReadBranchFilter(scope, query.branchId));

    const discounted = rows.filter((r) => r.discount > 0);
    const gross = sum(rows.map((r) => r.gross));
    const discount = sum(rows.map((r) => r.discount));
    const summary = {
      activeChildren: rows.length,
      gross,
      discount,
      net: gross - discount,
      discountedChildren: discounted.length,
      reviewCount: rows.filter((r) => r.status === "REVIEW").length,
      averageRate: discounted.length ? Math.round((sum(discounted.map((r) => r.rate)) / discounted.length) * 100) : 0,
      highImpactThreshold: HIGH_IMPACT_DISCOUNT,
    };

    const groups = new Map<string, { groupId: string; name: string; children: number; gross: number; discount: number; discounted: number; rateSum: number }>();
    for (const r of rows) {
      const key = r.groupId ?? "none";
      const g = groups.get(key) ?? { groupId: key, name: r.groupName ?? "Guruhsiz", children: 0, gross: 0, discount: 0, discounted: 0, rateSum: 0 };
      g.children += 1;
      g.gross += r.gross;
      g.discount += r.discount;
      if (r.discount > 0) {
        g.discounted += 1;
        g.rateSum += r.rate;
      }
      groups.set(key, g);
    }
    const byGroup = [...groups.values()]
      .map(({ rateSum, ...g }) => ({ ...g, net: g.gross - g.discount, averageRate: g.discounted ? Math.round((rateSum / g.discounted) * 100) : 0 }))
      .sort((a, b) => b.discount - a.discount || a.name.localeCompare(b.name));

    return {
      period,
      currentPeriod: currentPeriod(),
      summary,
      byGroup,
      children: rows.sort((a, b) => b.discount - a.discount || a.fullName.localeCompare(b.fullName)),
    };
  }

  /**
   * "Tez chegirma" — oila a'zolari: bir ota-onaga (yoki bir telefon
   * raqamiga) bog'langan bolalar aniq oila; bir xil familiya — taxmin.
   * Odatda chegirma ikkinchi farzanddan beriladi.
   */
  async suggestions(caller: TenantAuthenticatedUser, query: DiscountQueryDto) {
    const scope = toTenantScope(caller);
    assertDiscountReader(scope);
    const period = query.period ?? currentPeriod();
    const branchId = resolveReadBranchFilter(scope, query.branchId);
    const rows = await this.rows(scope, period, branchId);
    const byId = new Map(rows.map((r) => [r.childId, r]));

    const links = await this.prisma.childGuardian.findMany({
      where: { childId: { in: [...byId.keys()] } },
      select: { childId: true, guardian: { select: { id: true, phone: true } } },
    });
    const children = await this.prisma.child.findMany({ where: { id: { in: [...byId.keys()] } }, select: { id: true, lastName: true } });

    // Aniq oila: umumiy ota-ona yoki umumiy telefon — birlashtiriladi (union-find)
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      const p = parent.get(x) ?? x;
      if (p === x) return x;
      const root = find(p);
      parent.set(x, root);
      return root;
    };
    const union = (a: string, b: string) => parent.set(find(a), find(b));
    const phoneOf = new Map<string, string>();
    for (const l of links) {
      union(`c:${l.childId}`, `g:${l.guardian.id}`);
      const pk = phoneKey(l.guardian.phone);
      if (pk) {
        union(`c:${l.childId}`, `p:${pk}`);
        if (!phoneOf.has(l.childId)) phoneOf.set(l.childId, pk);
      }
    }
    const exact = new Map<string, string[]>();
    for (const id of byId.keys()) {
      const root = find(`c:${id}`);
      exact.set(root, [...(exact.get(root) ?? []), id]);
    }

    type Family = { key: string; reason: "GUARDIAN" | "SURNAME"; label: string; phone: string | null; children: DiscountChildRow[] };
    const lastNameOf = new Map(children.map((c) => [c.id, c.lastName]));
    const label = (ids: string[]) => [...new Set(ids.map((id) => lastNameOf.get(id) ?? ""))].filter(Boolean).join(" / ");
    const families: Family[] = [];
    const exactSets = new Set<string>();
    for (const [root, ids] of exact) {
      if (ids.length < 2) continue;
      const sorted = [...ids].sort();
      exactSets.add(sorted.join(","));
      const pk = ids.map((id) => phoneOf.get(id)).find(Boolean) ?? null;
      families.push({ key: `guardian:${root}`, reason: "GUARDIAN", label: label(ids), phone: pk ? formatPhone(pk) : null, children: ids.map((id) => byId.get(id)!) });
    }

    // Taxmin: bir xil familiya (Aliyev ≈ Aliyeva)
    const bySurname = new Map<string, string[]>();
    for (const c of children) {
      const key = surnameKey(c.lastName);
      if (key) bySurname.set(key, [...(bySurname.get(key) ?? []), c.id]);
    }
    for (const [key, ids] of bySurname) {
      if (ids.length < 2) continue;
      if (exactSets.has([...ids].sort().join(","))) continue;
      families.push({ key: `surname:${key}`, reason: "SURNAME", label: label(ids), phone: null, children: ids.map((id) => byId.get(id)!) });
    }

    families.sort((a, b) => (a.reason === b.reason ? b.children.length - a.children.length || a.label.localeCompare(b.label) : a.reason === "GUARDIAN" ? -1 : 1));
    for (const f of families) f.children.sort((a, b) => a.fullName.localeCompare(b.fullName));
    return { period, families };
  }

  /** Bolaning barcha chegirma qoidalari (eng yangisi birinchi) va joriy oydagi natija */
  async forChild(caller: TenantAuthenticatedUser, childId: string) {
    const scope = toTenantScope(caller);
    assertDiscountReader(scope);
    const branchId = resolveReadBranchFilter(scope);
    const child = await this.prisma.child.findFirst({
      where: { id: childId, organizationId: scope.organizationId, ...(branchId ? { branchId } : {}) },
      select: { id: true },
    });
    if (!child) throw new NotFoundException("Bola topilmadi");
    const period = currentPeriod();
    const [row] = await this.rows(scope, period, branchId, [childId]);
    const rules = await this.prisma.childDiscount.findMany({ where: { childId }, select: ruleView, orderBy: { createdAt: "desc" } });
    return { period, current: row ?? null, history: rules.map(toRuleDto) };
  }

  async create(caller: TenantAuthenticatedUser, dto: CreateDiscountDto) {
    const scope = toTenantScope(caller);
    const branchId = requireMoneyScope(scope);
    const input = normalizeInput(dto);
    const child = await this.childInBranch(scope, branchId, dto.childId);

    const result = await this.prisma.$transaction((tx) => this.giveOne(tx, caller, scope, branchId, child.id, input), { timeout: 30000 });
    await this.auditLog.logFromUser(caller, {
      action: "discount.create",
      entityType: "ChildDiscount",
      entityId: result.discount.id,
      branchId,
      summary: [
        `${child.fullName}: ${result.replaced.length ? "chegirma almashtirildi" : "chegirma berildi"} — ${discountText(result.discount)} (${discountScopeText(result.discount)})`,
        input.reason ? `sabab: ${input.reason}` : null,
        invoicesNote(result.invoices),
      ]
        .filter(Boolean)
        .join("; "),
    });
    return { discount: toRuleDto(result.discount), replaced: result.replaced.map(toRuleDto), invoices: result.invoices };
  }

  async bulkCreate(caller: TenantAuthenticatedUser, dto: BulkCreateDiscountDto) {
    const scope = toTenantScope(caller);
    const branchId = requireMoneyScope(scope);
    const input = normalizeInput(dto);
    const ids = [...new Set(dto.childIds)];
    const children = await this.prisma.child.findMany({
      where: { id: { in: ids }, organizationId: scope.organizationId, branchId },
      select: { id: true, fullName: true },
    });
    if (children.length !== ids.length) throw new NotFoundException("Ba'zi bolalar topilmadi yoki boshqa filialda");

    const results = await this.prisma.$transaction(
      async (tx) => {
        const out = [];
        for (const c of children) out.push({ child: c, ...(await this.giveOne(tx, caller, scope, branchId, c.id, input)) });
        return out;
      },
      { timeout: 120000 },
    );
    const replacedCount = results.filter((r) => r.replaced.length > 0).length;
    const invoices = mergeInvoiceResults(results.map((r) => r.invoices));
    const names = results.map((r) => r.child.fullName);
    await this.auditLog.logFromUser(caller, {
      action: "discount.bulk_create",
      entityType: "ChildDiscount",
      branchId,
      summary: [
        `Ommaviy chegirma — ${results.length} ta bola: ${discountText(results[0].discount)} (${discountScopeText(results[0].discount)})`,
        `${names.slice(0, 5).join(", ")}${names.length > 5 ? ` va yana ${names.length - 5} ta` : ""}`,
        input.reason ? `sabab: ${input.reason}` : null,
        replacedCount ? `${replacedCount} ta bolaning eski chegirmasi almashtirildi` : null,
        invoicesNote(invoices),
      ]
        .filter(Boolean)
        .join("; "),
    });
    return {
      count: results.length,
      replacedCount,
      invoices,
      items: results.map((r) => ({ id: r.discount.id, childId: r.child.id, name: r.child.fullName, replaced: r.replaced.length > 0 })),
    };
  }

  /**
   * Tahrirlash. Doimiy chegirma o'tgan oylarda amal qilgan bo'lsa va
   * summasi o'zgarsa — o'tgan oylar eski qoidada qoladi: eskisi shu oydan
   * to'xtatiladi va yangisi shu oydan boshlanadi. Faqat sabab o'zgarsa —
   * joyida yangilanadi.
   */
  async update(caller: TenantAuthenticatedUser, id: string, dto: UpdateDiscountDto) {
    const scope = toTenantScope(caller);
    const branchId = requireMoneyScope(scope);
    const existing = await this.prisma.childDiscount.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: { ...ruleView, branchId: true, childId: true, child: { select: { fullName: true } } },
    });
    if (!existing) throw new NotFoundException("Chegirma topilmadi");
    if (existing.branchId !== branchId) throw new ForbiddenException("Bu chegirma boshqa filialda");
    if (!existing.isActive) throw new BadRequestException("To'xtatilgan chegirmani tahrirlab bo'lmaydi — yangisini bering");

    const cur = currentPeriod();
    const type = dto.type ?? existing.type;
    const scopeKind = dto.scope ?? existing.scope;
    const value = dto.value ?? Number(existing.value);
    const error = discountInputError(type, value);
    if (error) throw new BadRequestException(error);
    const startPeriod =
      scopeKind === "ONE_MONTH" ? (dto.period ?? (existing.scope === "ONE_MONTH" ? existing.startPeriod : null)) : existing.scope === "PERMANENT" ? existing.startPeriod : cur;
    if (!startPeriod) throw new BadRequestException("Bir oylik chegirma uchun oyni tanlang");
    const reason = dto.reason === undefined ? existing.reason : dto.reason.trim() || null;
    const moneyChanged = type !== existing.type || scopeKind !== existing.scope || value !== Number(existing.value) || startPeriod !== existing.startPeriod;

    const result = await this.prisma.$transaction(
      async (tx) => {
        const before = await childRules(tx, existing.childId);
        const now = new Date();
        let discount: RuleView;
        let previousId: string | null = null;
        const splitPermanent = moneyChanged && existing.scope === "PERMANENT" && existing.startPeriod < cur;
        const fromOneMonth = moneyChanged && existing.scope === "ONE_MONTH" && scopeKind === "PERMANENT";
        if (splitPermanent || fromOneMonth) {
          // O'tgan oylik bir martalik chegirma o'z oyida qoladi; aks holda eskisi to'xtatiladi
          if (!(fromOneMonth && existing.startPeriod < cur)) {
            await tx.childDiscount.update({
              where: { id },
              data: { isActive: false, endedAt: now, ...(existing.scope === "PERMANENT" ? { endPeriod: cur } : {}) },
            });
          }
          discount = await tx.childDiscount.create({
            data: {
              organizationId: scope.organizationId,
              branchId,
              childId: existing.childId,
              type,
              scope: scopeKind,
              value,
              // Doimiy qism shu oydan boshlanadi — o'tgan oylar eski qoidada qoladi
              startPeriod: scopeKind === "PERMANENT" ? cur : startPeriod,
              reason,
              createdByName: caller.fullName,
              createdByUserId: caller.id,
            },
            select: ruleView,
          });
          previousId = id;
        } else {
          discount = await tx.childDiscount.update({ where: { id }, data: { type, scope: scopeKind, value, startPeriod, reason }, select: ruleView });
        }
        const replaced = await retireSameSlot(tx, existing.childId, scopeKind, discount.startPeriod, [discount.id, id]);
        const after = await childRules(tx, existing.childId);
        const invoices = await applyRuleChangeToInvoices(tx, {
          organizationId: scope.organizationId,
          branchId,
          childId: existing.childId,
          before,
          after,
          note: "Chegirma o'zgartirildi",
        });
        return { discount, replaced, previousId, invoices };
      },
      { timeout: 30000 },
    );

    const fromText = `${discountText(existing)} (${discountScopeText(existing)})`;
    const toText = `${discountText(result.discount)} (${discountScopeText(result.discount)})`;
    await this.auditLog.logFromUser(caller, {
      action: "discount.update",
      entityType: "ChildDiscount",
      entityId: result.discount.id,
      branchId,
      summary: [
        `${existing.child.fullName}: chegirma o'zgartirildi${fromText !== toText ? ` — ${fromText} → ${toText}` : ""}`,
        reason !== existing.reason ? (reason ? `sabab: ${reason}` : "sabab olib tashlandi") : null,
        result.previousId ? "shu oydan boshlab; o'tgan oylar avvalgi chegirmada qoladi" : null,
        invoicesNote(result.invoices),
      ]
        .filter(Boolean)
        .join("; "),
    });
    return { discount: toRuleDto(result.discount), replaced: result.replaced.map(toRuleDto), previousId: result.previousId, invoices: result.invoices };
  }

  /**
   * To'xtatish (o'chirish emas — tarix saqlanadi). Doimiy chegirma shu oydan
   * boshlab amal qilmaydi, o'tgan oylar o'zgarmaydi; bir oylik chegirma o'z
   * oyidan ham olib tashlanadi. To'langan oylar baribir o'zgarmaydi.
   */
  async end(caller: TenantAuthenticatedUser, id: string) {
    const scope = toTenantScope(caller);
    const branchId = requireMoneyScope(scope);
    const existing = await this.prisma.childDiscount.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: { ...ruleView, branchId: true, childId: true, child: { select: { fullName: true } } },
    });
    if (!existing) throw new NotFoundException("Chegirma topilmadi");
    if (existing.branchId !== branchId) throw new ForbiddenException("Bu chegirma boshqa filialda");
    if (!existing.isActive) throw new BadRequestException("Bu chegirma allaqachon to'xtatilgan");

    const cur = currentPeriod();
    const result = await this.prisma.$transaction(
      async (tx) => {
        const before = await childRules(tx, existing.childId);
        const discount = await tx.childDiscount.update({
          where: { id },
          data: {
            isActive: false,
            endedAt: new Date(),
            ...(existing.scope === "PERMANENT" ? { endPeriod: existing.startPeriod > cur ? existing.startPeriod : cur } : {}),
          },
          select: ruleView,
        });
        const after = await childRules(tx, existing.childId);
        const invoices = await applyRuleChangeToInvoices(tx, {
          organizationId: scope.organizationId,
          branchId,
          childId: existing.childId,
          before,
          after,
          note: "Chegirma to'xtatildi",
        });
        return { discount, invoices };
      },
      { timeout: 30000 },
    );
    await this.auditLog.logFromUser(caller, {
      action: "discount.end",
      entityType: "ChildDiscount",
      entityId: id,
      branchId,
      summary: [
        `${existing.child.fullName}: chegirma to'xtatildi — ${discountText(existing)} (${discountScopeText(existing)})`,
        existing.reason ? `sabab edi: ${existing.reason}` : null,
        existing.scope === "PERMANENT" ? "shu oydan boshlab; o'tgan oylar o'zgarmaydi" : null,
        invoicesNote(result.invoices),
      ]
        .filter(Boolean)
        .join("; "),
    });
    return { discount: toRuleDto(result.discount), invoices: result.invoices };
  }

  // ---------------------------------------------------------------------------

  private async giveOne(tx: Tx, caller: TenantAuthenticatedUser, scope: TenantScope, branchId: string, childId: string, input: NormalizedInput) {
    const before = await childRules(tx, childId);
    const replaced = await retireSameSlot(tx, childId, input.scope, input.startPeriod, []);
    const discount = await tx.childDiscount.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        childId,
        type: input.type,
        scope: input.scope,
        value: input.value,
        startPeriod: input.startPeriod,
        reason: input.reason,
        createdByName: caller.fullName,
        createdByUserId: caller.id,
      },
      select: ruleView,
    });
    const after = await childRules(tx, childId);
    const invoices = await applyRuleChangeToInvoices(tx, {
      organizationId: scope.organizationId,
      branchId,
      childId,
      before,
      after,
      note: replaced.length ? "Chegirma almashtirildi" : "Chegirma berildi",
    });
    return { discount, replaced, invoices };
  }

  private async childInBranch(scope: TenantScope, branchId: string, childId: string) {
    const child = await this.prisma.child.findFirst({
      where: { id: childId, organizationId: scope.organizationId },
      select: { id: true, fullName: true, branchId: true },
    });
    if (!child) throw new NotFoundException("Bola topilmadi");
    if (child.branchId !== branchId) throw new ForbiddenException("Bu bola boshqa filialda");
    return child;
  }

  /** Faol bolalar uchun shu oydagi narx, chegirma va qoida */
  private async rows(scope: TenantScope, period: string, branchId: string | undefined, onlyIds?: string[]): Promise<DiscountChildRow[]> {
    const children: ChildForDiscount[] = await this.prisma.child.findMany({
      where: {
        organizationId: scope.organizationId,
        status: "ACTIVE",
        ...(branchId ? { branchId } : {}),
        ...(onlyIds ? { id: { in: onlyIds } } : {}),
      },
      select: childSelect,
    });
    const [branches, invoices] = await Promise.all([
      this.prisma.branch.findMany({
        where: { organizationId: scope.organizationId, id: { in: [...new Set(children.map((c) => c.branchId))] } },
        select: { id: true, name: true, defaultTuitionAmount: true },
      }),
      this.prisma.invoice.findMany({
        where: { childId: { in: children.map((c) => c.id) }, period, status: { not: InvoiceStatus.CANCELLED } },
        select: { childId: true, amount: true, discountAmount: true },
      }),
    ]);
    const branchById = new Map(branches.map((b) => [b.id, b]));
    const invoiceByChild = new Map<string, { amount: number; discount: number }>();
    for (const inv of invoices) {
      const prev = invoiceByChild.get(inv.childId) ?? { amount: 0, discount: 0 };
      invoiceByChild.set(inv.childId, { amount: prev.amount + Number(inv.amount), discount: prev.discount + Number(inv.discountAmount) });
    }

    return children.map((c) => {
      const branch = branchById.get(c.branchId)!;
      const rule = chooseDiscount(c.childDiscounts, period);
      const invoice = invoiceByChild.get(c.id);
      const gross = invoice ? invoice.amount : monthlyFeeOf(c.group, branch);
      const discount = invoice ? invoice.discount : discountAmountOf(rule, gross);
      return {
        childId: c.id,
        publicId: c.publicId,
        fullName: c.fullName,
        groupId: c.group?.id ?? null,
        groupName: c.group?.name ?? null,
        branchId: c.branchId,
        branchName: branch.name,
        gross,
        discount,
        net: Math.max(0, gross - discount),
        rate: gross > 0 ? discount / gross : 0,
        invoiced: Boolean(invoice),
        status: discount >= HIGH_IMPACT_DISCOUNT ? "REVIEW" : discount > 0 ? "ACTIVE" : "NONE",
        rule: rule ? toRuleDto(rule) : null,
      };
    });
  }
}

// -----------------------------------------------------------------------------

interface NormalizedInput {
  type: DiscountType;
  scope: DiscountScope;
  value: number;
  startPeriod: string;
  reason: string | null;
}

function normalizeInput(dto: { type: DiscountType; scope: DiscountScope; value: number; period?: string; reason?: string }): NormalizedInput {
  const error = discountInputError(dto.type, dto.value);
  if (error) throw new BadRequestException(error);
  if (dto.scope === "ONE_MONTH" && !dto.period) throw new BadRequestException("Bir oylik chegirma uchun oyni tanlang");
  return {
    type: dto.type,
    scope: dto.scope,
    value: dto.value,
    // Doimiy chegirma doim joriy oydan boshlanadi — o'tgan oylar o'zgarmaydi
    startPeriod: dto.scope === "ONE_MONTH" ? dto.period! : currentPeriod(),
    reason: dto.reason?.trim() || null,
  };
}

/**
 * Shu "joy"dagi eski faol qoidalarni to'xtatadi: doimiy — boshqa doimiysi
 * (shu oydan), bir oylik — shu oyning bir oyligi. Eskilari tarixda qoladi.
 */
async function retireSameSlot(tx: Tx, childId: string, scope: DiscountScope, startPeriod: string, excludeIds: string[]): Promise<RuleView[]> {
  const old = await tx.childDiscount.findMany({
    where: {
      childId,
      isActive: true,
      scope,
      ...(scope === "ONE_MONTH" ? { startPeriod } : {}),
      id: { notIn: excludeIds },
    },
    select: ruleView,
  });
  const now = new Date();
  const cur = currentPeriod();
  for (const rule of old) {
    await tx.childDiscount.update({
      where: { id: rule.id },
      data: { isActive: false, endedAt: now, ...(scope === "PERMANENT" ? { endPeriod: rule.startPeriod > cur ? rule.startPeriod : cur } : {}) },
    });
  }
  return old;
}

function assertDiscountReader(scope: TenantScope) {
  if (scope.role === "TEACHER" || scope.role === "CHEF") {
    throw new ForbiddenException("Chegirmalar bo'limi faqat moliya va rahbariyat uchun");
  }
}

type InvoiceResult = { changed: InvoiceDiscountChange[]; paidUnchanged: string[]; capped: string[] };

function mergeInvoiceResults(list: InvoiceResult[]): InvoiceResult {
  return {
    changed: list.flatMap((r) => r.changed),
    paidUnchanged: list.flatMap((r) => r.paidUnchanged),
    capped: list.flatMap((r) => r.capped),
  };
}

function invoicesNote(r: InvoiceResult): string | null {
  const parts = [];
  if (r.changed.length) parts.push(`${r.changed.length} ta hisob-faktura moslandi (${[...new Set(r.changed.map((c) => c.period))].join(", ")})`);
  if (r.paidUnchanged.length) parts.push(`to'langan oylar o'zgarmadi (${[...new Set(r.paidUnchanged)].join(", ")})`);
  return parts.length ? parts.join("; ") : null;
}

function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

function formatPhone(nine: string): string {
  return `${nine.slice(0, 2)} ${nine.slice(2, 5)} ${nine.slice(5, 7)} ${nine.slice(7)}`;
}
