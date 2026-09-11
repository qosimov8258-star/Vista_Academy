import type { Metadata } from "next";
import { PostLoginLoadingScreen } from "@/components/PostLoginLoadingScreen";
import { PostLoginLoadingProvider } from "@/lib/post-login-loading";
import { QueryProvider } from "@/lib/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bog'chalar tarmog'i — Platform Admin",
  description: "SaaS Platform Super Admin paneli",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>
        {/* Eng tepada, boshqa hamma narsadan oldin chaqiriladi — batafsili
            izoh LoadingScreen.tsx faylining o'zida keltirilgan. Sign-in
            muvaffaqiyatli bo'lgach dashboard tayyor bo'lgunicha shu yerda
            ko'rsatiladi (holat: src/lib/post-login-loading.tsx). */}
        <PostLoginLoadingProvider>
          <PostLoginLoadingScreen />
          <QueryProvider>{children}</QueryProvider>
        </PostLoginLoadingProvider>
      </body>
    </html>
  );
}
