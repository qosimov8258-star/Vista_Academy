import { Manrope } from "next/font/google";

// Kirish sahifasining o'z shrifti: aniq, zamonaviy grotesk — premium ko'rinish
// uchun. Faqat shu sahifaga yuklanadi; panelning qolgan qismi tizim shriftida.
// Kirill ham bor — rus tilida ham bir xil ko'rinadi.
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={manrope.className}>{children}</div>;
}
