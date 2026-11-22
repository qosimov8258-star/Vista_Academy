import { NextResponse, type NextRequest } from "next/server";
import { fetchOrganizationName } from "@/lib/tenant-metadata";
import { tenantSlugFromHost, toExternalPath } from "@/lib/tenant-host";
import { pwaManifestHref } from "@/lib/pwa";

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * `/_pwa/manifest?org=<slug>&app=staff|parent` — bog'chaning ilova manifesti.
 *
 * Har bog'chaning ikkita alohida ilovasi bor (`id` har xil): xodimlar paneli
 * va ota-onalar kabineti. Nomi — bog'cha nomi, ochiladigan manzil — o'sha
 * panelning bosh sahifasi. Subdomenda (babyland.zeeron.uz) manzil toza
 * (`/`, `/ota-ona`), oddiy rejimda — `/{slug}`, `/ota-ona/{slug}`.
 */
export async function GET(req: NextRequest) {
  const org = (req.nextUrl.searchParams.get("org") ?? "").toLowerCase();
  const app = req.nextUrl.searchParams.get("app") === "parent" ? "parent" : "staff";
  if (!SLUG.test(org)) return NextResponse.json({ message: "org noto'g'ri" }, { status: 400 });

  const internal = app === "parent" ? `/ota-ona/${org}` : `/${org}`;
  const onSubdomain = tenantSlugFromHost(req.headers.get("host")) === org;
  const start = onSubdomain ? (toExternalPath(internal, org) ?? internal) || "/" : internal;
  const name = (await fetchOrganizationName(org)) ?? "Zeeron";

  const manifest = {
    id: `/_pwa/app/${app}/${org}`,
    name,
    short_name: name,
    description: app === "parent" ? `${name}: ota-onalar kabineti` : `${name}: bog'cha boshqaruv paneli`,
    lang: "uz",
    dir: "ltr",
    start_url: start,
    scope: start,
    display: "standalone",
    background_color: "#F2F2F7",
    theme_color: "#F2F2F7",
    icons: [
      { src: "/_pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/_pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/_pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Brauzer tabida «ilova allaqachon o'rnatilganmi» deb so'rash uchun (getInstalledRelatedApps)
    related_applications: [{ platform: "webapp", url: pwaManifestHref(org, app) }],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
