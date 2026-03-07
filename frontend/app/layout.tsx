import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { Sidebar } from "@/components/Sidebar";
import { StatusBar } from "@/components/StatusBar";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://repodar.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Repodar — Real-time GitHub AI Ecosystem Radar",
    template: "%s | Repodar",
  },
  description: "Discover the most trending AI/ML repos on GitHub by day, week, month, or year. Live breakout alerts, commit heatmaps, and deep-dive analytics.",
  keywords: ["GitHub", "AI", "ML", "trending repos", "open source", "radar", "LLM", "machine learning"],
  openGraph: {
    type: "website",
    siteName: "Repodar",
    title: "Repodar — Real-time GitHub AI Ecosystem Radar",
    description: "Live AI/ML GitHub repo tracking — trend scores, breakout alerts, sustainability ratings.",
    url: BASE_URL,
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "Repodar" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Repodar — Real-time GitHub AI Ecosystem Radar",
    description: "Live AI/ML GitHub repo tracking — trend scores, breakout alerts, sustainability ratings.",
    images: ["/og-default.png"],
  },
  alternates: {
    types: {
      "application/rss+xml": [
        { url: `${process.env.NEXT_PUBLIC_API_URL ?? ""}/feed.xml`, title: "Repodar Breakout Alerts" },
      ],
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Cyberpunk fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700;800&family=Syne:wght@400;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <Sidebar />
          <Nav />
          <main
            style={{
              marginLeft: "var(--sidebar-width, 220px)",
              maxWidth: "100%",
              marginTop: "48px",
              padding: "0 28px 52px",
              overflowX: "hidden",
              transition: "margin-left 0.3s ease",
            }}
          >
            {children}
          </main>
          <StatusBar />
        </Providers>
      </body>
    </html>
  );
}

