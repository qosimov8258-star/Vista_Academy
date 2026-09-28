import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Statik dizayn fayllari (rasm/video) Cloudflare R2'dan berilsa,
// next/image'ga o'sha domendan yuklashga ruxsat berish kerak.
const cdnHostname = process.env.NEXT_PUBLIC_CDN_URL ? new URL(process.env.NEXT_PUBLIC_CDN_URL).hostname : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    contentDispositionType: "inline",
    remotePatterns: cdnHostname ? [{ protocol: "https", hostname: cdnHostname }] : [],
  },
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default withNextIntl(nextConfig);
