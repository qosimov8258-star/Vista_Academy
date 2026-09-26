import type { Metadata } from "next";
import { Baloo_2 } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={baloo2.variable}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
