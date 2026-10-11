import { absoluteUrl } from "@/lib/seo";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/cli-auth",
          "/my-pages/",
          "/api/",
          "/app",
          "/settings/",
          "/og/",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
