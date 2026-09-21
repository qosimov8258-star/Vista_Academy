"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { parentApi } from "@/lib/parent-api";

/**
 * "Foydali" bo'limi mazmuni: she'rlar, maqollar, ertaklar. Ularni
 * tarbiyachilar panelda qo'shadi; server ota-onaga faqat bolasining filiali
 * yoki guruhiga tegishli, e'lon qilingan mazmunni qaytaradi.
 *
 *   GET /app/parent/useful/poems         → Poem[]
 *   GET /app/parent/useful/poems/:id     → Poem
 *   GET /app/parent/useful/proverbs      → Proverb[]
 *   GET /app/parent/useful/tales         → Tale[]
 *   GET /app/parent/useful/tales/:id     → Tale
 *
 * Maydonlar shartnomasi: docs/foydali-api.md §3.
 */

export interface Poem {
  id: string;
  title: string;
  /** Shoir. Noma'lum bo'lsa null — sahifada ko'rsatilmaydi. */
  author: string | null;
  /** Qo'shgan tarbiyachi */
  addedBy: string;
  /** Qaysi guruh uchun; null — barcha guruhlar */
  groupName: string | null;
  ageFrom: number;
  ageTo: number;
  /** Bandlar, har biri qatorlardan iborat */
  stanzas: string[][];
  /** ISO sana (YYYY-MM-DD) */
  addedAt: string;
}

export interface Proverb {
  id: string;
  text: string;
  /** Bolaga tushuntirish uchun sodda izoh */
  meaning: string;
}

export interface Tale {
  id: string;
  title: string;
  /** Kelib chiqishi: "O'zbek xalq ertagi", muallif ismi va h.k. */
  origin: string;
  /** Taxminiy o'qish vaqti, daqiqa */
  minutes: number;
  paragraphs: string[];
  /** Ertak saboqi — nimani o'rgatadi */
  moral: string;
  /** O'qib bo'lgach bolaga beriladigan savollar */
  questions: string[];
  addedBy: string;
  /** Muqova rasmi (API faqat shu ikkitasini qabul qiladi) */
  cover: "sholgom" | "tun";
  addedAt: string;
}

// Mazmun kun davomida kam o'zgaradi: bo'limlar orasida yurganda qayta so'ralmaydi
const FRESH_FOR = 5 * 60_000;

/** 404 — o'chirilgan yoki boshqa guruhniki: qayta urinish befoyda */
function retryUnlessGone(count: number, error: unknown): boolean {
  return !(error instanceof ApiError && (error.status === 404 || error.status === 401)) && count < 1;
}

export function usePoems() {
  return useQuery({
    queryKey: ["useful", "poems"],
    queryFn: () => parentApi.get<Poem[]>("/app/parent/useful/poems"),
    staleTime: FRESH_FOR,
    retry: retryUnlessGone,
  });
}

/**
 * Bitta she'r. Ro'yxatdan kelgan bo'lsa, o'sha ma'lumot darhol ko'rsatiladi —
 * sahifa bo'sh turmaydi, orqa fonda esa yangilanadi.
 */
export function usePoem(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["useful", "poems", id],
    queryFn: () => parentApi.get<Poem>(`/app/parent/useful/poems/${encodeURIComponent(id)}`),
    staleTime: FRESH_FOR,
    retry: retryUnlessGone,
    placeholderData: () => queryClient.getQueryData<Poem[]>(["useful", "poems"])?.find((poem) => poem.id === id),
  });
}

export function useProverbs() {
  return useQuery({
    queryKey: ["useful", "proverbs"],
    queryFn: () => parentApi.get<Proverb[]>("/app/parent/useful/proverbs"),
    staleTime: FRESH_FOR,
    retry: retryUnlessGone,
  });
}

export function useTales() {
  return useQuery({
    queryKey: ["useful", "tales"],
    queryFn: () => parentApi.get<Tale[]>("/app/parent/useful/tales"),
    staleTime: FRESH_FOR,
    retry: retryUnlessGone,
  });
}

export function useTale(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["useful", "tales", id],
    queryFn: () => parentApi.get<Tale>(`/app/parent/useful/tales/${encodeURIComponent(id)}`),
    staleTime: FRESH_FOR,
    retry: retryUnlessGone,
    placeholderData: () => queryClient.getQueryData<Tale[]>(["useful", "tales"])?.find((tale) => tale.id === id),
  });
}

/** Xato "topilmadi" (o'chirilgan yoki boshqa guruhniki) ekanini bildiradi */
export function isGone(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
