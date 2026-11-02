import type { Gender } from "./types";

export function formatMoney(value: string | number, currency = "UZS"): string {
  const num = typeof value === "string" ? Number(value) : value;
  return `${Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${currency}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "02.11.2026" — brauzer tiliga bog'liq emas (uz-UZ "2026-11-02" berardi) */
export function formatDate(value: string): string {
  const d = new Date(value);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** "02.11.2026, 20:47" */
export function formatDateTime(value: string): string {
  const d = new Date(value);
  return `${formatDate(value)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatChildId(publicId: number): string {
  return `id${publicId}`;
}

/** Migratsiyadan oldingi bolalarda jins noma'lum bo'lishi mumkin. */
export function formatGender(gender: Gender | null): string {
  if (gender === "MALE") return "O'g'il bola";
  if (gender === "FEMALE") return "Qiz bola";
  return "Jinsi ko'rsatilmagan";
}

/**
 * "+998901234375" -> "+998 90 123 43 75". Nusxalashda xom qiymat ishlatiladi:
 * bo'shliqli variant terish dasturlariga yopishtirilganda muammo qiladi.
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("998")) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  return phone;
}

/** Tug'ilgan sanadan yosh: bir yoshgacha oyda, keyin yilda. */
export function formatAge(birthDate: string): string {
  const born = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) {
    months -= 1;
  }
  if (months < 0) return "—";
  if (months < 12) return `${months} oylik`;
  return `${Math.floor(months / 12)} yosh`;
}
