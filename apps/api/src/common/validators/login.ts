/**
 * Yangi yaratiladigan login uchun umumiy format: lotin harf, raqam, `. _ -`,
 * kamida 3, ko'pi bilan 32 belgi. Xodim kabineti (`generateEmployeeLogin`),
 * tashkilot/filial/xodim login yaratish shakllarida ishlatiladi.
 *
 * Kirish (sign-in) maydonlarida bu qoida QO'LLANILMAYDI — eski hisoblar
 * `email` ustunidan `login`ga ko'chirilgan bo'lib, ularda "@" bo'lishi
 * mumkin (masalan "admin@quyoshcha.uz"), shuning uchun u yerda faqat
 * bo'sh emasligi tekshiriladi.
 */
export const LOGIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$/;
export const LOGIN_PATTERN_MESSAGE =
  "Login lotin harf, raqam, . _ - dan iborat bo'lishi va kamida 3 belgi bo'lishi kerak";
