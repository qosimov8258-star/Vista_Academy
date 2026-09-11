import { ParentTabBar } from "./tab-bar";
import { ParentPageTransition } from "./page-transition";
import { CabinetThemeProvider } from "./theme";

/**
 * Kabinet qobig'i. Fon va ko'rinish (yorug'/qorong'i) CabinetThemeProvider'da
 * beriladi — sahifalarning har biri o'zi qo'ysa, pastki menyu ostidagi bo'sh
 * joyda boshqaruv panelining kulrang foni ko'rinib qolardi.
 *
 * Kirish sahifasi bu guruhdan tashqarida: u yerda pastki menyu kerak emas.
 */
export default async function ParentCabinetLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <CabinetThemeProvider slug={slug}>
      {/* Pastki menyu mazmunni yopib qolmasligi uchun joy qoldiriladi */}
      <div className="pb-[104px]">
        <ParentPageTransition slug={slug}>{children}</ParentPageTransition>
      </div>
      <ParentTabBar slug={slug} />
    </CabinetThemeProvider>
  );
}
