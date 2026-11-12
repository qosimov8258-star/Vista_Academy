import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { tenantMetadata } from "@/lib/tenant-metadata";

// Kirish sahifasining o'z shrifti — Poppins. Faqat shu sahifaga yuklanadi;
// panelning qolgan qismi tizim shriftida. Poppins'da kirill yo'q — rus
// tilida kirill harflari tizim shriftida ko'rinadi.
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Kirish havolasi ulashilganda bog'cha nomi ko'rinsin. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return tenantMetadata((await params).slug);
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={poppins.className}>{children}</div>;
}
