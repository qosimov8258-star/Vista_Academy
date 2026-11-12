import { randomUUID } from "crypto";
import type { JwtService } from "@nestjs/jwt";
import { requireTenantAccessSecret } from "./tenant-auth.service";

/**
 * "Bog'chaga kirish" (impersonatsiya) chiptasi. Platforma operatori bog'cha
 * sahifasida tugmani bosadi → platforma API shu qisqa muddatli chiptani
 * beradi → brauzer bog'cha paneliga `/enter#t=<chipta>` bilan o'tadi → panel
 * chiptani `POST /app/auth/enter` ga yuborib, filial admini seansini oladi.
 *
 * Chipta URL'da (fragmentda — serverga, loglarga va Referer'ga tushmaydi)
 * bo'lgani uchun juda qisqa yashaydi va faqat bir marta ishlatiladi.
 */
export const ENTRY_TICKET_PURPOSE = "platform-entry";
export const ENTRY_TICKET_TTL_SECONDS = 60;

export interface PlatformEntryTicketPayload {
  purpose: typeof ENTRY_TICKET_PURPOSE;
  /** Kiriladigan bog'cha hisobi (TenantUser.id) */
  sub: string;
  organizationId: string;
  /** Kirgan platforma operatori — server logi uchun */
  operatorId: string;
  operatorName: string;
  jti: string;
}

export function signPlatformEntryTicket(
  jwt: JwtService,
  data: Omit<PlatformEntryTicketPayload, "purpose" | "jti">,
): string {
  const payload: PlatformEntryTicketPayload = { ...data, purpose: ENTRY_TICKET_PURPOSE, jti: randomUUID() };
  return jwt.sign(payload, { secret: requireTenantAccessSecret(), expiresIn: ENTRY_TICKET_TTL_SECONDS });
}

/**
 * "Xodim kabinetiga kirish" chiptasi — filial admini xodimlar ro'yxatidan
 * o'z filialidagi tarbiyachi/oshpaz/administrator kabinetiga, o'sha xodim
 * o'zi kirgandek kiradi (ko'rish rejimi emas). Oqim platformadagi bilan bir
 * xil: qisqa muddatli bir martalik chipta → `/enter#t=` → `POST /app/auth/enter`.
 * Farqi: kirish bog'cha audit jurnaliga yoziladi.
 */
export const STAFF_ENTRY_PURPOSE = "staff-entry";

/** Filial admini kabinetiga kira oladigan rollar — undan pastdagilar. Boshqa
 *  filial admini, Super Admin va moliyachi (pul — admin huquqidan tashqari) yo'q. */
export const STAFF_ENTRY_ROLES: ReadonlySet<string> = new Set(["TEACHER", "CHEF", "MANAGER"]);

export interface StaffEntryTicketPayload {
  purpose: typeof STAFF_ENTRY_PURPOSE;
  /** Kiriladigan xodim hisobi (TenantUser.id) */
  sub: string;
  organizationId: string;
  branchId: string;
  /** Kirgan filial admini — jurnal uchun */
  operatorId: string;
  operatorName: string;
  jti: string;
}

export function signStaffEntryTicket(jwt: JwtService, data: Omit<StaffEntryTicketPayload, "purpose" | "jti">): string {
  const payload: StaffEntryTicketPayload = { ...data, purpose: STAFF_ENTRY_PURPOSE, jti: randomUUID() };
  return jwt.sign(payload, { secret: requireTenantAccessSecret(), expiresIn: ENTRY_TICKET_TTL_SECONDS });
}

/**
 * Ishlatilgan chiptalar (jti) — muddati tugaguncha xotirada. API bitta
 * jarayonda ishlaydi (pm2 fork), chipta esa 60 soniya yashaydi, shuning
 * uchun alohida jadval shart emas: qayta ishga tushganda ham eski chipta
 * baribir muddati o'tgan bo'ladi.
 */
const usedTickets = new Map<string, number>();

/** true — chipta birinchi marta ishlatilmoqda; false — avval ishlatilgan. */
export function consumeTicketId(jti: string, expiresAtMs: number): boolean {
  const now = Date.now();
  for (const [id, exp] of usedTickets) {
    if (exp < now) usedTickets.delete(id);
  }
  if (usedTickets.has(jti)) return false;
  usedTickets.set(jti, expiresAtMs);
  return true;
}
