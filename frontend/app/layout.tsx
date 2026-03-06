import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { Sidebar } from "@/components/Sidebar";
import { StatusBar } from "@/components/StatusBar";

export const metadata: Metadata = {
  title: "Repodar — Real-time GitHub AI Ecosystem Radar",
  description: "Discover the most trending AI/ML repos on GitHub by day, week, month, or year.",
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

