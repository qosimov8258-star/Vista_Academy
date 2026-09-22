import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

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
        <Topbar slug={slug} />
        {/* min-h-0 bo'lmasa flex elementi mazmunidan kichrayolmaydi va scroll ishlamaydi.
            Pastki bo'shliq mobilda kattaroq — o'qituvchi uchun ekran pastida
            turadigan navigatsiya panel mazmunni yopib qo'ymasligi kerak. */}
        <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-24 pt-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
