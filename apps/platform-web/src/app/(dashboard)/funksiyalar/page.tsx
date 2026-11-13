"use client";

import { FeatureModules } from "@/features/feature-flags/feature-modules";

export default function FunksiyalarPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[30px] font-medium leading-tight tracking-[-0.02em] text-[var(--color-text)]">Funksiyalar</h1>
        <p className="text-[13.5px] text-[var(--color-text-muted)]">
          Har bir bog&apos;cha uchun modullarni butun bog&apos;cha yoki alohida panel bo&apos;yicha yoqing yoki o&apos;chiring
        </p>
      </header>
      <FeatureModules />
    </div>
  );
}
