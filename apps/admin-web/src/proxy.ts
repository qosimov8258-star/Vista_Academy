import { NextRequest, NextResponse } from "next/server";

// Top-level page names that live directly under /{orgSlug}/... — anything else
// in that position is treated as a per-branch entry link (see below).
const KNOWN_ORG_PAGES = new Set([
  "login",
  "children",
  "groups",
  "employees",
  "attendance",
  "lesson-attendance",
  "staff-attendance",
  "nutrition",
  "cash",
  "debtors",
  "cash-report",
  "group-payments",
  "calls",
  "board",
  "pickups",
  "weekly-report",
  "staff-absences",
  "finance",
  "branches",
  "users",
  "crm",
  "hr",
  "notifications",
  "lessons",
  "my-lessons",
  "coin",
  "my-notifications",
  "settings",
  "useful",
]);

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return atob(padded);
}

interface RoutingClaims {
  organizationSlug: string | null;
  role: string | null;
}

/**
 * Reads routing-hint claims out of the access token without verifying the
 * signature — this is only used to decide which page to render, never for
 * authorization (the API independently verifies and re-derives scope from
 * the token, including role and branch, on every request).
 */
function decodeRoutingClaims(token: string | undefined): RoutingClaims {
  if (!token) return { organizationSlug: null, role: null };
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return { organizationSlug: null, role: null };
    const payload = JSON.parse(base64UrlDecode(payloadSegment)) as { organizationSlug?: string; role?: string };
    return { organizationSlug: payload.organizationSlug ?? null, role: payload.role ?? null };
  } catch {
    return { organizationSlug: null, role: null };
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return NextResponse.next();
  }

  const slug = segments[0];
  const second = segments[1];
  const isLogin = second === "login";

  const token = req.cookies.get("bogcha_tenant_at")?.value;
  const { organizationSlug: tokenOrgSlug, role } = decodeRoutingClaims(token);
  // A cookie only grants access to THIS org's URL if its token either predates
  // the org-slug claim (treated as unknown, not a mismatch) or actually matches.
  const hasSession = !!token && (tokenOrgSlug === null || tokenOrgSlug === slug);

  if (!isLogin && !hasSession) {
    const loginUrl = new URL(`/${slug}/login`, req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // MUHIM: bu yerda "isLogin && hasSession" holatida login sahifasidan
  // avtomatik uzoqlashtirish YO'Q — atayin. Auth cookie butun brauzerga
  // umumiy (tab-bo'yicha emas), shuning uchun bitta tabda kirilgan
  // foydalanuvchining cookie'si boshqa (yangi) tabda ham "hasSession=true"
  // ko'rsatadi. Avval shu yerda avtomatik yo'naltirish bo'lgani uchun
  // ikkinchi tab login formasiga umuman yetib bormay, birinchi tabning
  // cookie'si asosida to'g'ridan-to'g'ri boshqa foydalanuvchi sifatida
  // dashboardga tashlanardi. Login sahifasi cookie holatidan qat'iy nazar
  // har doim ko'rsatiladi — haqiqiy identifikatsiya endi shu tabning
  // sessionStorage'dagi tokeni orqali (Authorization header, ko'ring:
  // lib/api.ts) aniqlanadi, cookie faqat zaxira.

  // Each branch gets its own bookmarkable link: /{orgSlug}/{branchSlug}[/...].
  // For a branch-scoped role (BRANCH_ADMIN/MANAGER) that link is purely cosmetic —
  // their branch is resolved from the JWT, not the URL — so it transparently
  // rewrites onto the same shared pages. NETWORK_ADMIN has no fixed branch, so
  // for them this segment is a REAL route: it renders a dashboard scoped to
  // that specific branch (see app/(dashboard)/[slug]/[branchSlug]/page.tsx).
  if (second && !KNOWN_ORG_PAGES.has(second) && role !== "NETWORK_ADMIN") {
    const rest = segments.slice(2).join("/");
    const target = new URL(rest ? `/${slug}/${rest}` : `/${slug}`, req.url);
    target.search = req.nextUrl.search;
    return NextResponse.rewrite(target);
  }

  return NextResponse.next();
}

export const config = {
  // `ota-ona` — ota-ona kabineti: u o'z autentifikatsiyasiga ega va xodimlar
  // seansiga bog'liq emas, shuning uchun bu proxy unga umuman tegmaydi.
  // `face-model`, `logo.png`, `cursor.png`/`cursor@2x.png`,
  // `pointer.png`/`pointer@2x.png` — public/ dagi statik fayllar (yuzni
  // aniqlash modeli, brend logotipi, custom kursor rasmlari — @2x
  // Retina/HiDPI ekranlar uchun). Ular chiqarib tashlanmasa, proxy
  // birinchi bo'lakni tashkilot slug'i deb o'ylab, so'rovni login
  // sahifasiga yo'naltiradi.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|face-model|ota-ona|logo.png|cursor.png|cursor@2x.png|pointer.png|pointer@2x.png).*)",
  ],
};
