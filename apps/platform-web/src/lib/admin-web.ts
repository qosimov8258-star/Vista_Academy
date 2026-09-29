const ADMIN_WEB_URL = process.env.NEXT_PUBLIC_ADMIN_WEB_URL ?? "http://localhost:3001";

/**
 * Bog'chalar subdomeni (admin-web'dagi NEXT_PUBLIC_TENANT_BASE_DOMAIN bilan bir xil):
 * berilsa har bir bog'cha o'z manzilida — https://<slug>.zeeron.uz. Berilmasa
 * avvalgidek ADMIN_WEB_URL/<slug>.
 */
const TENANT_BASE_DOMAIN = (process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN ?? "").trim().toLowerCase();

export function organizationAccessUrl(slug: string): string {
  if (TENANT_BASE_DOMAIN) {
    // Protokol va port admin-web manzilidan: serverda https, lokalda http://<slug>.localhost:3101
    const admin = new URL(ADMIN_WEB_URL);
    return `${admin.protocol}//${slug}.${TENANT_BASE_DOMAIN}${admin.port ? `:${admin.port}` : ""}`;
  }
  return `${ADMIN_WEB_URL}/${slug}`;
}
