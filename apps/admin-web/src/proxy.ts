import { NextRequest, NextResponse } from "next/server";
import { TENANT_SLUG_HEADER, tenantSlugFromHost, toExternalPath, toInternalPath } from "@/lib/tenant-host";

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
  "lending",
  "face-id",
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
  const hostSlug = tenantSlugFromHost(req.headers.get("host"));
  // Mijoz bu sarlavhani o'zi yubora olmasin — faqat shu yerda qo'yiladi
  const headers = new Headers(req.headers);
  headers.delete(TENANT_SLUG_HEADER);

  if (!hostSlug) {
    // Oddiy (subdomensiz) rejim — avvalgidek /{slug}/... manzillar.
    // Ota-ona kabinetining o'z autentifikatsiyasi bor, unga tegilmaydi.
    if (req.nextUrl.pathname.startsWith("/ota-ona")) return NextResponse.next({ request: { headers } });
    return routeTenant(req, req.nextUrl.pathname, null, headers);
  }

  // Bog'cha subdomeni (babyland.zeeron.uz): manzilda slug takrorlanmaydi.
  // Ilova ichidagi havolalar hali /{slug}/... ko'rinishida quriladi — ular
  // toza manzilga yo'naltiriladi (brauzer satrida doim /attendance kabi).
  const external = toExternalPath(req.nextUrl.pathname, hostSlug);
  if (external !== null) {
    const url = new URL(external, req.url);
    url.search = req.nextUrl.search;
    return NextResponse.redirect(url, 308);
  }
  // Ota-onaning alohida kirish sahifasi o'rniga — umumiy kirish formasi
  if (req.nextUrl.pathname === "/ota-ona/kirish") {
    const url = new URL("/login", req.url);
    url.search = req.nextUrl.search;
    return NextResponse.redirect(url);
  }

  headers.set(TENANT_SLUG_HEADER, hostSlug);
  const internal = toInternalPath(req.nextUrl.pathname, hostSlug);
  if (internal.startsWith("/ota-ona/")) {
    const url = new URL(internal, req.url);
    url.search = req.nextUrl.search;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return routeTenant(req, internal, hostSlug, headers);
}

/**
 * Xodimlar paneli: seans tekshiruvi va filial havolalari. `pathname` —
 * ilova ichidagi yo'l (/{slug}/...). Subdomenda (`hostSlug`) yo'naltirishlar
 * toza manzilga, qayta yozishlar ichki yo'lga qilinadi.
 */
function routeTenant(req: NextRequest, pathname: string, hostSlug: string | null, headers: Headers) {
  const segments = pathname.split("/").filter(Boolean);
  const outward = (internalPath: string) => (hostSlug ? (toExternalPath(internalPath, hostSlug) ?? internalPath) : internalPath);
  const passThrough = () => {
    if (!hostSlug) return NextResponse.next({ request: { headers } });
    const url = new URL(pathname, req.url);
    url.search = req.nextUrl.search;
    return NextResponse.rewrite(url, { request: { headers } });
  };
  if (segments.length === 0) {
    return passThrough();
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
    const loginUrl = new URL(outward(`/${slug}/login`), req.url);
    loginUrl.searchParams.set("next", outward(pathname));
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
    return NextResponse.rewrite(target, { request: { headers } });
  }

  return passThrough();
}

export const config = {
  // `ota-ona` — ota-ona kabineti: u o'z autentifikatsiyasiga ega, proxy
  // unga faqat subdomenda (manzilni ichki yo'lga o'girish uchun) tegadi.
  // `api` — lokalda API shu host orqali (next.config rewrites), serverda nginx.
  // `face-model`, `logo.png`, `cursor.png`/`cursor@2x.png`,
  // `pointer.png`/`pointer@2x.png` — public/ dagi statik fayllar (yuzni
  // aniqlash modeli, brend logotipi, custom kursor rasmlari — @2x
  // Retina/HiDPI ekranlar uchun). Ular chiqarib tashlanmasa, proxy
  // birinchi bo'lakni tashkilot slug'i deb o'ylab, so'rovni login
  // sahifasiga yo'naltiradi.
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon.ico|face-model|logo.png|cursor.png|cursor@2x.png|pointer.png|pointer@2x.png).*)",
  ],
};
