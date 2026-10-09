import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { SubscriptionBanner } from "@/components/layout/subscription-banner";
import { MainScroll } from "@/components/layout/main-scroll";
import { ChefBottomBar } from "@/features/chef/chef-bottom-bar";
import { TeacherTabBar } from "@/features/teacher/teacher-tab-bar";
import { ThemeSync } from "@/lib/theme";
import { tenantMetadata } from "@/lib/tenant-metadata";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return tenantMetadata((await params).slug);
}

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    // Qobiq aynan ekran balandligida turadi: shunda yon panel va yuqori panel
    // joyida qoladi, faqat <main> ichidagi mazmun aylanadi. Avval `min-h-screen`
    // edi — qobiq mazmun bilan cho'zilib, brauzerning o'zi sahifani aylantirar,
    // yon panel ham u bilan birga ketardi.
    <div className="flex h-dvh overflow-hidden bg-[var(--color-bg)]">
      <Sidebar slug={slug} />
      <div className="flex min-w-0 flex-1 flex-col">
        <ImpersonationBanner slug={slug} />
        <SubscriptionBanner slug={slug} />
        <Topbar slug={slug} />
        {/* min-h-0 bo'lmasa flex elementi mazmunidan kichrayolmaydi va scroll ishlamaydi.
            Pastki bo'shliq mobilda kattaroq — o'qituvchi uchun ekran pastida
            turadigan navigatsiya panel mazmunni yopib qo'ymasligi kerak. */}
        <MainScroll className="min-h-0 flex-1 overflow-y-auto px-6 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 md:py-6">
          {children}
        </MainScroll>
      </div>
      {/* Faqat oshpazga, faqat telefonda — boshqa rollar uchun hech narsa chizmaydi */}
      <ChefBottomBar slug={slug} />
      {/* Faqat tarbiyachiga, faqat telefonda — pastki tab-bar */}
      <TeacherTabBar slug={slug} />
      {/* Hisobdagi tizim rangini qo'llaydi — hech narsa chizmaydi */}
      <ThemeSync />
    </div>
  );
}
