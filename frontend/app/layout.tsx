import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { Sidebar } from "@/components/Sidebar";

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
      </head>
      <body>
        <Providers>
          <Sidebar />
          <Nav />
          <main
            style={{
              marginLeft: "var(--sidebar-width, 240px)",
              maxWidth: "100%",
              marginTop: "56px",
              padding: "0 24px 60px",
              overflowX: "hidden",
              transition: "margin-left 0.3s ease",
            }}
          >
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}

