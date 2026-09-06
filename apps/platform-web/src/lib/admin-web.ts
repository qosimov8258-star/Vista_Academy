const ADMIN_WEB_URL = process.env.NEXT_PUBLIC_ADMIN_WEB_URL ?? "http://localhost:3001";

export function organizationAccessUrl(slug: string): string {
  return `${ADMIN_WEB_URL}/${slug}`;
}
