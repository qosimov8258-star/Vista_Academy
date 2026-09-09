import { ParentTabBar } from "./tab-bar";
import styles from "../parent.module.css";

/**
 * Kabinet qobig'i. Fon shu yerda beriladi — sahifalarning har biri o'zi
 * qo'ysa, pastki menyu ostidagi bo'sh joyda boshqaruv panelining kulrang
 * foni ko'rinib qolardi.
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
    <div className={`${styles.shell} ${styles.sky} min-h-[100dvh]`}>
      {/* Pastki menyu mazmunni yopib qolmasligi uchun joy qoldiriladi */}
      <div className="pb-[104px]">{children}</div>
      <ParentTabBar slug={slug} />
    </div>
  );
}
