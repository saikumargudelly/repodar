import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://repodar.vercel.app";
const API_URL  = process.env.NEXT_PUBLIC_API_URL  ?? "http://localhost:8000";

async function fetchRepoIds(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/repos?per_page=200`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    
    // Check if it's the new paginated structure
    const data = await res.json();
    if (data && data.items && Array.isArray(data.items)) {
      return data.items.map((r: any) => r.id);
    }
    // Fallback just in case
    if (Array.isArray(data)) {
      return data.map((r: any) => r.id);
    }
    return [];
  } catch {
    return [];
  }
}

async function fetchSnapshotIds(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/snapshots`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data: Array<{ week_id: string }> = await res.json();
    return data.map((s) => s.week_id);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [repoIds, snapshotIds] = await Promise.all([fetchRepoIds(), fetchSnapshotIds()]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                   lastModified: new Date(), changeFrequency: "hourly",  priority: 1.0 },
    { url: `${BASE_URL}/radar`,        lastModified: new Date(), changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE_URL}/leaderboard`,  lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE_URL}/alerts`,       lastModified: new Date(), changeFrequency: "hourly",  priority: 0.8 },
    { url: `${BASE_URL}/search`,       lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/weekly`,       lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/compare`,      lastModified: new Date(), changeFrequency: "weekly",  priority: 0.6 },
  ];

  const repoPages: MetadataRoute.Sitemap = repoIds.map((id) => ({
    url: `${BASE_URL}/repo/${id}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const snapshotPages: MetadataRoute.Sitemap = snapshotIds.map((id) => ({
    url: `${BASE_URL}/weekly/${id}`,
    lastModified: new Date(),
    changeFrequency: "never" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...repoPages, ...snapshotPages];
}
