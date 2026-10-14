"use client";

import { DashboardFeaturesPanel } from "@/features/feature-flags/dashboard-features-panel";

export default function FunksiyalarPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[30px] font-medium leading-tight tracking-[-0.02em] text-[var(--color-text)]">Funksiyalar</h1>
        <p className="text-[13.5px] text-[var(--color-text-muted)]">
          Har bir bog&apos;cha uchun panel bo&apos;yicha funksiyalarni yoqing yoki o&apos;chiring
        </p>
      </header>
      <DashboardFeaturesPanel />
    </div>
  );
}
