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
          "/_next/",
          "/p/*/embed",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
