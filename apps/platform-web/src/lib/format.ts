export function formatMoney(value: string | number, currency = "UZS"): string {
  const num = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(num) + " " + currency;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(value),
  );
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const ROLE_LABEL: Record<string, string> = {
  PLATFORM_SUPER_ADMIN: "Super Admin",
  PLATFORM_SUPPORT: "Support",
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

// Ism/emaildan bosh harflarni olamiz — avatar rasm o'rniga
export function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
const MONTHS_LONG = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];
const WEEKDAYS_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

/** "2026-10" → "Okt" */
export function monthShort(monthKey: string): string {
  return MONTHS_SHORT[Number(monthKey.split("-")[1]) - 1] ?? monthKey;
}

export function monthLong(index: number): string {
  return MONTHS_LONG[index] ?? "";
}

export function weekdayShort(index: number): string {
  return WEEKDAYS_SHORT[index] ?? "";
}

/** "1 Okt 2026" — kalit so'zlari o'zbekcha, brauzer lokaliga bog'liq emas. */
export function formatDayMonth(value: string | Date): string {
  const date = new Date(value);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/** Katta summalar uchun qisqa ko'rinish: 23 902 000 → "23,9 mln". */
export function formatCompactMoney(value: number): string {
  const abs = Math.abs(value);
  const fmt = (n: number) => new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 1 }).format(n);
  if (abs >= 1_000_000_000) return `${fmt(value / 1_000_000_000)} mlrd`;
  if (abs >= 1_000_000) return `${fmt(value / 1_000_000)} mln`;
  if (abs >= 1_000) return `${fmt(value / 1_000)} ming`;
  return fmt(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(value);
}

/** Obuna muddati yorlig'i: "3 kun qoldi" / "2 kun o'tdi" va urg'u darajasi. */
export function expiryLabel(periodEnd: string, now: number = Date.now()): { label: string; tone: "danger" | "warning" | "neutral" } {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const diff = new Date(periodEnd).getTime() - now;
  if (diff < 0) return { label: `${Math.max(1, Math.ceil(-diff / DAY_MS))} kun o'tdi`, tone: "danger" };
  const days = Math.max(1, Math.ceil(diff / DAY_MS));
  return { label: `${days} kun qoldi`, tone: days <= 3 ? "warning" : "neutral" };
}
