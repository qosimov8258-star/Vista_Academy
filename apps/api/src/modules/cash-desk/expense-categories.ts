/**
 * Xarajat turkumlari — qat'iy ro'yxat (hisobotda "Boshqa" hammasini yutib
 * yubormasin). Frontendda ikonka/rang bilan shu tartibda ko'rsatiladi
 * (`admin-web/src/features/expenses/categories.ts`). Avvalgi 6 ta turkum
 * (Xo'jalik mollari, Tozalik, Ta'mirlash, Ofis, Transport, Boshqa) ham shu
 * ro'yxatda — eski yozuvlar o'zgarmaydi. Ish haqi bu yerda yo'q: u
 * "Ish haqi" bo'limida alohida hisoblanadi (ikki marta ayirilmasin).
 */
export const EXPENSE_CATEGORIES = [
  "Oziq-ovqat",
  "Xo'jalik mollari",
  "Tozalik",
  "Kommunal",
  "Ijara",
  "Ta'mirlash",
  "Jihozlar",
  "Transport",
  "Ofis",
  "Reklama",
  "Soliq",
  "Boshqa",
] as const;
