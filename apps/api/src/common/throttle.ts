import { UseGuards, applyDecorators } from "@nestjs/common";
import { Throttle, ThrottlerGuard, type ThrottlerModuleOptions } from "@nestjs/throttler";

/**
 * So'rovlar sonini IP bo'yicha cheklash. Global guard qo'yilmagan — faqat
 * taxmin qilib buzish mumkin bo'lgan ochiq yo'llarda (login, ariza formasi).
 * IP nginx'ning X-Forwarded-For sarlavhasidan olinadi (main.ts: trust proxy) —
 * aks holda hamma so'rov 127.0.0.1 dan kelgandek ko'rinib, bitta foydalanuvchi
 * butun bog'chani bloklab qo'yardi.
 */
export const THROTTLER_OPTIONS: ThrottlerModuleOptions = {
  throttlers: [
    { name: "short", ttl: 60_000, limit: 10 },
    { name: "long", ttl: 60 * 60_000, limit: 100 },
  ],
  errorMessage: "Juda ko'p urinish — birozdan keyin qayta urinib ko'ring",
};

/**
 * Login: bir IP'dan daqiqasiga 10 ta, soatiga 100 ta urinish. Bog'chada bir
 * Wi-Fi'dan ko'p xodim kirsa ham yetadi, parolni tanlab topishga esa yetmaydi.
 */
export const LoginThrottle = () =>
  applyDecorators(
    UseGuards(ThrottlerGuard),
    Throttle({ short: { ttl: 60_000, limit: 10 }, long: { ttl: 60 * 60_000, limit: 100 } }),
  );

/** Ochiq forma (lending arizasi): bir IP'dan 10 daqiqada 5 ta, soatiga 20 ta — spamga qarshi. */
export const PublicFormThrottle = () =>
  applyDecorators(
    UseGuards(ThrottlerGuard),
    Throttle({ short: { ttl: 10 * 60_000, limit: 5 }, long: { ttl: 60 * 60_000, limit: 20 } }),
  );
