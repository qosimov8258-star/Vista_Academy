import type { Metadata } from "next";
import { Baloo_2 } from "next/font/google";
import { QueryProvider } from "@/lib/query-provider";
import "./globals.css";

const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-baloo",
});

export const metadata: Metadata = {
  title: "Bog'chalar tarmog'i — Admin",
  description: "Tarmoq va filial boshqaruvi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={baloo2.variable}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
