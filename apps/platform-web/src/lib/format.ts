const TENANT_BASE_URL = (process.env.NEXT_PUBLIC_TENANT_BASE_URL ?? "https://bogcha.uz").replace(/\/+$/, "");

export function bogchaPublicUrl(slug: string): string {
  return `${TENANT_BASE_URL}/${slug}`;
}

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
