import type { Metadata } from "next";

const API_URL  = process.env.NEXT_PUBLIC_API_URL  ?? "http://localhost:8000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://repodar.vercel.app";

interface Props {
  params: Promise<{ id: string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // id may be ["owner", "name"] or ["owner/name"]
  const repoId = id.join("/");
  const [owner, ...rest] = repoId.split("/");
  const name = rest.join("/");

  let repo: {
    name?: string;
    owner?: string;
    description?: string | null;
    repo_summary?: string | null;
    category?: string;
    stars?: number | null;
  } | null = null;

  try {
    const res = await fetch(`${API_URL}/repos/${repoId}`, { next: { revalidate: 900 } });
    if (res.ok) repo = await res.json();
  } catch {
    // fall through to defaults
  }

  const title       = repo ? `${repo.owner}/${repo.name}` : repoId;
  const description = repo?.repo_summary ?? repo?.description ??
    `Deep-dive analytics for ${repoId} — trend score, star history, commit activity, and more.`;
  const ogImageUrl  = `${SITE_URL}/api/og/repo/${owner}/${name}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Repodar`,
      description,
      url: `${SITE_URL}/repo/${repoId}`,
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

export default function RepoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
