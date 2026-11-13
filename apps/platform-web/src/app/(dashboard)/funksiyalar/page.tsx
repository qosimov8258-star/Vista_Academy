"use client";

import { FeatureMatrix } from "@/features/feature-flags/feature-matrix";

export default function FunksiyalarPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[30px] font-medium leading-tight tracking-[-0.02em] text-[var(--color-text)]">Funksiyalar</h1>
        <p className="text-[13.5px] text-[var(--color-text-muted)]">
          Bog&apos;chani tanlang — jadvalda har bir funksiyani butun bog&apos;cha yoki alohida panel uchun bir bosishda yoqing yoki o&apos;chiring
        </p>
      </header>
      <FeatureMatrix />
    </div>
  );
}
