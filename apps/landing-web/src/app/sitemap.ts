import type { MetadataRoute } from "next";

const SITE_URL = "https://vistaacademy.uz";

const ROUTES = ["", "/jadval", "/taomlar", "/tarbiyachi", "/talim-yonalishi", "/oqituvchilar", "/ariza"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
