import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";

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
          <Nav />
          <main style={{ maxWidth: "1600px", margin: "0 auto", padding: "0 16px 40px", width: "100%", overflowX: "hidden" }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}

