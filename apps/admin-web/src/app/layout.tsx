import type { Metadata } from "next";
import { Baloo_2 } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { headers } from "next/headers";
import { QueryProvider } from "@/lib/query-provider";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-config";
import { TENANT_SLUG_HEADER } from "@/lib/tenant-host";
import { TrProvider } from "@/i18n/tr";
import { loadDict } from "@/i18n/dict";
import { TenantHostProvider } from "@/lib/tenant-host-context";
import { tenantMetadata } from "@/lib/tenant-metadata";
import "./globals.css";

const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-baloo",
});

/**
 * Bog'cha subdomenida (babyland.zeeron.uz) — o'sha bog'cha nomi bilan;
 * havola Telegram'ga tashlansa ham shu ko'rinadi. Subdomensiz rejimda
 * (/{slug}/...) nomni [slug] layout'lari qo'yadi.
 */
export async function generateMetadata(): Promise<Metadata> {
  return tenantMetadata((await headers()).get(TENANT_SLUG_HEADER));
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dict = await loadDict(locale);
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
          <TrProvider dict={dict}>
            <TenantHostProvider slug={tenantHostSlug}>
              <QueryProvider>{children}</QueryProvider>
            </TenantHostProvider>
          </TrProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
