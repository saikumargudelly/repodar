import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://repodar.vercel.app";

interface Props {
  children: React.ReactNode;
  params: Promise<{ weekId: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ weekId: string }> }): Promise<Metadata> {
  const { weekId } = await params;
  let reposCount = 0;
  try {
    const res = await fetch(`${API_URL}/snapshots/${weekId}`, { next: { revalidate: 900 } });
    if (res.ok) {
      const data = await res.json();
      reposCount = data.repos?.length ?? 0;
    }
  } catch {
    // fall through
  }

  const title = `Weekly AI/ML Radar (Edition #${weekId})`;
  const description = `Automated ecosystem telemetry tracking ${reposCount} active repositories this week. Real-time velocity, growth acceleration, and sustainability scores.`;
  const ogImageUrl = `${SITE_URL}/api/og/weekly/${weekId}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Repodar`,
      description,
      url: `${SITE_URL}/weekly/${weekId}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Repodar`,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function WeeklyLayout({ children }: Props) {
  return <>{children}</>;
}
