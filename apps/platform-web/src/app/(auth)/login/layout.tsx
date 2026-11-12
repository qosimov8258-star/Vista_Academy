import { Poppins } from "next/font/google";

// Kirish sahifasining o'z shrifti — Poppins (bog'cha panelining kirishidagidek).
// Faqat shu sahifaga yuklanadi; panelning qolgan qismi o'z shriftida.
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={poppins.className}>{children}</div>;
}
