import { randomInt } from "crypto";

/** Loginda faqat lotin harf-raqamlari qoladi — ism/familiyada kirill yoki belgi bo'lsa ham login buzilmaydi. */
function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

/**
 * "ism.familiya" ko'rinishidagi login taklif qiladi. Tashkilot ichida band
 * bo'lsa, `isTaken` orqali tekshirilib, band bo'lmaguncha raqam qo'shiladi
 * (masalan "dilnoza.yusupova2").
 */
export async function generateEmployeeLogin(
  firstName: string,
  lastName: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = [slugify(firstName), slugify(lastName)].filter(Boolean).join(".") || "xodim";
  let candidate = base;
  let suffix = 1;
  while (await isTaken(candidate)) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** O'qilishi oson bo'lishi uchun chalkash belgilar (0/O, 1/l/I) chiqarib tashlangan. */
export function generateEmployeePassword(length = 10): string {
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}
