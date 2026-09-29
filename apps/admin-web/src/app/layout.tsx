import type { Metadata } from "next";
import { Baloo_2 } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { headers } from "next/headers";
import { QueryProvider } from "@/lib/query-provider";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-config";
import { TENANT_SLUG_HEADER } from "@/lib/tenant-host";
import { TenantHostProvider } from "@/lib/tenant-host-context";
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
  // Bog'cha subdomenida (babyland.zeeron.uz) proxy qo'ygan slug — menyular
  // toza manzilni ilova ichidagi yo'lga to'g'ri solishtirishi uchun
  const tenantHostSlug = (await headers()).get(TENANT_SLUG_HEADER);

  return (
    // data-theme'ni skript chizishdan oldin qo'yadi — server HTML'ida u yo'q
    <html lang={locale} className={baloo2.variable} suppressHydrationWarning>
      <head>
        {/* Tanlangan tizim rangi (Sozlamalar) — sahifa yashil bo'lib "sakramasligi" uchun */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TenantHostProvider slug={tenantHostSlug}>
            <QueryProvider>{children}</QueryProvider>
          </TenantHostProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
