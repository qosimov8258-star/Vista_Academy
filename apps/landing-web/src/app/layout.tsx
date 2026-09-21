import type { Metadata } from "next";
import { Baloo_2 } from "next/font/google";
import "./globals.css";

const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo",
});

export const metadata: Metadata = {
  title: "Vista Academy — Bog'chalar tarmog'i",
  description:
    "Vista Academy — bolalarni mehr, xavfsizlik va zamonaviy ta'lim metodikalari bilan o'stiradigan bog'chalar tarmog'i.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={baloo2.variable}>
      <body>{children}</body>
    </html>
  );
}
