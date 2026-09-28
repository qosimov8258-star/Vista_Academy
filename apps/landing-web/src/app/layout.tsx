import type { Metadata } from "next";
import { Baloo_2 } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { BusIntro } from "@/components/bus-intro";

const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("siteMeta");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={baloo2.variable}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <BusIntro />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
