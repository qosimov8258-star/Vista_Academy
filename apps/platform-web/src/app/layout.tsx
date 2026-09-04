import type { Metadata } from "next";
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
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
