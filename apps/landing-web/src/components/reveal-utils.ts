export type RevealDirection = "left" | "right" | "up" | "down";

/**
 * Zig-zag effekt uchun — juft/toq indeksga qarab chapdan yoki o'ngdan
 * kirish yo'nalishini tanlaydi. Oddiy funksiya bo'lgani uchun server
 * komponentlarda ham (masalan async sahifalarda) bemalol chaqiriladi —
 * "use client" belgilangan `reveal.tsx`dagi funksiyalarni esa server
 * komponentdan to'g'ridan-to'g'ri chaqirib bo'lmaydi.
 */
export function alternatingDirection(index: number): "left" | "right" {
  return index % 2 === 0 ? "left" : "right";
}

export function staggerDelay(index: number, step = 90, max = 540) {
  return Math.min(index * step, max);
}
