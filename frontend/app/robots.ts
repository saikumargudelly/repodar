import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://repodar.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/sign-in",
          "/sign-up",
          "/dev",
          "/widget/",
          "/overview",
          "/watchlist",
          "/alerts",
          "/collections",
          "/settings",
          "/profile",
          "/research",
          "/post-auth",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
