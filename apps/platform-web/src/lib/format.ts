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
