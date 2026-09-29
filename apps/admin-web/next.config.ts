import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  /**
   * Lokalda API'ni shu host orqali chaqirish (API_PROXY_TARGET berilsa) —
   * serverdagi nginx kabi: bog'cha subdomenida (usmon.localhost:3101) ota-ona
   * seansi cookie'lari o'sha hostda turadi. Serverda bu kerak emas.
   */
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");
    return target ? [{ source: "/api/v1/:path*", destination: `${target}/api/v1/:path*` }] : [];
  },
};

export default withNextIntl(nextConfig);
