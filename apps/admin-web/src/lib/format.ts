import type { Gender } from "./types";

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

/** Bolaning qisqa raqami. Bazada son, ko'rsatishda "id12345". */
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
