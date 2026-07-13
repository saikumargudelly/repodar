"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useEffect, useState, useRef } from "react";
import { api, SnapshotDetail } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { toPng } from "html-to-image";

/* ─────────────────────────────────────────────────────────────
   Per-repo analyst commentary
───────────────────────────────────────────────────────────── */
function generateInsightCommentary(repo: any) {
  const velocity = repo.star_velocity_7d ?? 0;
  const accel = repo.acceleration ?? 0;
  const label = repo.sustainability_label || "GREEN";
  const name = `${repo.owner}/${repo.name}`;

  const velocityText =
    velocity > 250
      ? `surging at +${velocity.toLocaleString("en-US", { maximumFractionDigits: 0 })} stars/day, signaling a viral breakout moment`
      : velocity > 80
      ? `growing steadily at +${velocity.toLocaleString("en-US", { maximumFractionDigits: 0 })} stars/day via consistent organic traction`
      : `attracting +${velocity.toLocaleString("en-US", { maximumFractionDigits: 0 })} stars/day of baseline interest`;

  const accelText =
    accel > 2.0
      ? ` The ${accel.toFixed(1)}x acceleration indicates a major inflection — a new release, viral thread, or conference buzz.`
      : accel > 1.2
      ? ` Its ${accel.toFixed(1)}x acceleration suggests genuine positive momentum above historical norms.`
      : ` Growth remains in steady-state with no unusual acceleration signals.`;

  const healthText =
    label === "GREEN"
      ? ` Jonin-tier health reflects robust maintenance, active issue resolution, and production-safe integration.`
      : label === "YELLOW"
      ? ` Chunin-tier health warrants monitoring — PR delays or contributor flux have been detected.`
      : ` Genin-tier health flags maintenance risk; high issue-to-close ratios despite trending velocity.`;

  return `${name} is ${velocityText}.${accelText}${healthText}`;
}

/* ─────────────────────────────────────────────────────────────
   Health helpers
───────────────────────────────────────────────────────────── */
function healthLabel(label: string) {
  if (label === "GREEN") return "Jonin";
  if (label === "YELLOW") return "Chunin";
  return "Genin";
}
function healthColor(label: string) {
  if (label === "GREEN") return "#3fb950";
  if (label === "YELLOW") return "#d29922";
  return "#f85149";
}
function HealthDot({ label }: { label: string }) {
  return (
    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: healthColor(label), marginRight: 5, verticalAlign: "middle", flexShrink: 0 }} />
  );
}

/* ─────────────────────────────────────────────────────────────
   Velocity mini bar
───────────────────────────────────────────────────────────── */
function VeloBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginTop: 4, width: "100%" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(to right, #d29922, #f0a500)", borderRadius: 2, transition: "width 0.6s ease" }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────── */
export default function WeeklyDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = use(params);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  useEffect(() => {
    if (weekId) document.title = `Repodar Weekly Digest: ${weekId} | AI/ML Ecosystem Radar`;
  }, [weekId]);

  const { data: snapshot, isLoading, error } = useQuery<SnapshotDetail>({
    queryKey: ["snapshot", weekId],
    queryFn: () => api.getSnapshot(weekId),
    enabled: !!weekId,
  });

  const allRepos = snapshot?.repos ?? [];
  const featuredRepos = allRepos.slice(0, 10);
  const secondaryRepos = allRepos.slice(10);
  const maxVelocity = allRepos.length ? Math.max(...allRepos.map(r => r.star_velocity_7d || 0)) : 0;
  const avgAccel = allRepos.length ? allRepos.reduce((a, r) => a + (r.acceleration || 0), 0) / allRepos.length : 0;
  const healthyCount = allRepos.filter(r => r.sustainability_label === "GREEN" || r.sustainability_label === "HEALTHY").length;
  const yellowCount = allRepos.filter(r => r.sustainability_label === "YELLOW").length;
  const redCount = allRepos.filter(r => r.sustainability_label === "RED" || (!r.sustainability_label || (r.sustainability_label !== "GREEN" && r.sustainability_label !== "YELLOW" && r.sustainability_label !== "HEALTHY"))).length;
  const watchList = allRepos.filter(r => r.sustainability_label === "RED" || (!r.sustainability_label || (r.sustainability_label !== "GREEN" && r.sustainability_label !== "YELLOW" && r.sustainability_label !== "HEALTHY")));

  // Language distribution
  const langMap: Record<string, number> = {};
  allRepos.forEach(r => {
    if (r.primary_language) langMap[r.primary_language] = (langMap[r.primary_language] || 0) + 1;
  });
  const topLangs = Object.entries(langMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Top accelerators (sorted by acceleration descending)
  const topAccel = [...allRepos].sort((a, b) => (b.acceleration || 0) - (a.acceleration || 0)).slice(0, 5);

  // Category breakdown
  const catMap: Record<string, number> = {};
  allRepos.forEach(r => { if (r.category) catMap[r.category] = (catMap[r.category] || 0) + 1; });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Highest stars
  const topByStars = [...allRepos].sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 3);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportPoster = async () => {
    const container = carouselRef.current;
    if (!container) return;
    setExporting(true);
    setExportProgress("Preparing carousel pages...");
    try {
      const fileUrls: string[] = [];
      const totalSlides = 8;
      
      for (let i = 1; i <= totalSlides; i++) {
        setExportProgress(`Rendering slide ${i} of ${totalSlides}...`);
        const node = container.querySelector(`[data-page-index="${i}"]`) as HTMLElement;
        if (!node) continue;
        
        const dataUrl = await toPng(node, { pixelRatio: 3.2, quality: 1.0, cacheBust: true });
        fileUrls.push(dataUrl);
        await new Promise(r => setTimeout(r, 100));
      }
      
      setExportProgress("Downloading files...");
      const prefix = `repodar-weekly-${weekId}`;
      for (let i = 0; i < fileUrls.length; i++) {
        const link = document.createElement("a");
        link.download = `${prefix}-page-${i + 1}.png`;
        link.href = fileUrls[i];
        link.click();
        await new Promise(r => setTimeout(r, 250));
      }
      
      const manifest = {
        week: weekId,
        generatedAt: new Date().toISOString(),
        pageCount: totalSlides,
        width: 1080,
        height: 1350,
        pages: Array.from({ length: totalSlides }, (_, i) => ({
          index: i + 1,
          file: `${prefix}-page-${i + 1}.png`
        }))
      };
      
      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
      const manifestUrl = URL.createObjectURL(manifestBlob);
      const manifestLink = document.createElement("a");
      manifestLink.download = `${prefix}-manifest.json`;
      manifestLink.href = manifestUrl;
      manifestLink.click();
      URL.revokeObjectURL(manifestUrl);
      
      setExportProgress(null);
    } catch (err) {
      console.error("Failed to generate LinkedIn carousel pack", err);
      setExportProgress("Failed to export.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportSinglePage = async () => {
    const node = posterRef.current;
    if (!node) return;
    setExporting(true);
    setExportProgress("Rendering full page to PNG...");
    try {
      const dataUrl = await toPng(node, { pixelRatio: 3.2, quality: 1.0, cacheBust: true });
      const link = document.createElement("a");
      link.download = `repodar-weekly-${weekId}-full.png`;
      link.href = dataUrl;
      link.click();
      setExportProgress(null);
    } catch (err) {
      console.error("Failed to generate full page PNG", err);
      setExportProgress("Failed to export full page.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    const container = carouselRef.current;
    if (!container) return;
    setExporting(true);
    setExportProgress("Preparing pages for PDF...");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [1080, 1350]
      });

      const totalSlides = 8;
      for (let i = 1; i <= totalSlides; i++) {
        setExportProgress(`Rendering page ${i} of ${totalSlides} for PDF...`);
        const node = container.querySelector(`[data-page-index="${i}"]`) as HTMLElement;
        if (!node) continue;
        
        const dataUrl = await toPng(node, { pixelRatio: 2.0, quality: 0.95, cacheBust: true });
        if (i > 1) {
          pdf.addPage([1080, 1350], "portrait");
        }
        pdf.addImage(dataUrl, "PNG", 0, 0, 1080, 1350);
        await new Promise(r => setTimeout(r, 100));
      }
      
      setExportProgress("Saving PDF...");
      pdf.save(`repodar-weekly-${weekId}.pdf`);
      setExportProgress(null);
    } catch (err) {
      console.error("Failed to generate PDF", err);
      setExportProgress("Failed to export PDF.");
    } finally {
      setExporting(false);
    }
  };

  const handleShareToLinkedIn = async () => {
    const container = carouselRef.current;
    if (!container) return;
    setExporting(true);
    setExportProgress("Generating cover image for sharing...");
    try {
      const node = container.querySelector(`[data-page-index="1"]`) as HTMLElement;
      if (!node) return;
      
      const dataUrl = await toPng(node, { pixelRatio: 3.0, quality: 0.95, cacheBust: true });
      
      // Copy PNG to clipboard
      setExportProgress("Copying cover image to clipboard...");
      try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
      } catch (clipErr) {
        console.warn("Failed to write to clipboard directly, downloading instead", clipErr);
        // Fallback: download the image
        const link = document.createElement("a");
        link.download = `repodar-weekly-${weekId}-cover.png`;
        link.href = dataUrl;
        link.click();
      }
      
      // Create share text
      const shareText = `📊 Repodar Weekly AI/ML Radar (Edition #${weekId}) is live!\n\nHere are this week's breakout open-source projects:\n1️⃣ ${featuredRepos[0] ? `${featuredRepos[0].owner}/${featuredRepos[0].name}` : ""}\n2️⃣ ${featuredRepos[1] ? `${featuredRepos[1].owner}/${featuredRepos[1].name}` : ""}\n3️⃣ ${featuredRepos[2] ? `${featuredRepos[2].owner}/${featuredRepos[2].name}` : ""}\n\nCheck out the full telemetry health indicators, language distributions, and growth acceleration metrics: repodar.io/weekly/${weekId}\n\n#AI #ML #OpenSource #GitHub`;
      
      setExportProgress("Opening LinkedIn...");
      const linkedinUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareText)}`;
      window.open(linkedinUrl, "_blank");
      
      setExportProgress(null);
    } catch (err) {
      console.error("Failed to share to LinkedIn", err);
      setExportProgress("Failed to share.");
    } finally {
      setExporting(false);
    }
  };

  // Carousel helpers and styles
  const slideStyle: React.CSSProperties = {
    width: "1080px",
    height: "1350px",
    padding: "64px",
    boxSizing: "border-box",
    background: "#1e1d1c",
    color: "#e6edf3",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    fontFamily: "Inter, -apple-system, sans-serif",
    border: "1px solid #31302f",
    position: "relative",
    overflow: "hidden"
  };

  const metricStyle: React.CSSProperties = {
    background: "#262524",
    border: "1px solid #31302f",
    borderRadius: "6px",
    padding: "16px",
    textAlign: "center"
  };

  const chartCardStyle: React.CSSProperties = {
    background: "#262524",
    border: "1px solid #31302f",
    borderRadius: "8px",
    padding: "20px",
    boxSizing: "border-box",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  };

  const chartTitleStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 700,
    color: "#fff",
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid #31302f",
    paddingBottom: "8px"
  };

  const renderSlideFooter = (index: number) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #31302f", paddingTop: "12px", fontSize: "11px", color: "#8b949e", fontFamily: "monospace" }}>
      <span>repodar.io · Repodar Intelligence System</span>
      <span style={{ background: "rgba(0,240,255,0.1)", color: "#00f0ff", padding: "2px 8px", borderRadius: "4px", fontWeight: 700 }}>{index} / 8</span>
    </div>
  );

  const renderSlideHeader = (slideTitle: string, index: number) => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "linear-gradient(135deg, #00f0ff 0%, #0072ff 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0d14", fontWeight: 800, fontSize: "18px" }}>R</div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "0.05em", color: "#ffffff" }}>REPODAR</div>
            <div style={{ fontSize: "9px", fontFamily: "monospace", color: "#8b949e", letterSpacing: "0.1em" }}>INTELLIGENCE SYSTEM</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ border: "1px solid rgba(0,240,255,0.3)", background: "rgba(0,240,255,0.05)", color: "#00f0ff", padding: "4px 10px", borderRadius: "4px", fontSize: "11px", fontFamily: "monospace", fontWeight: 700 }}>WEEK {weekId}</div>
          <div style={{ border: "1px solid #31302f", background: "rgba(255,255,255,0.02)", color: "#8b949e", padding: "4px 10px", borderRadius: "4px", fontSize: "11px", fontFamily: "monospace", fontWeight: 700 }}>{index}/8</div>
        </div>
      </div>
      <div style={{ height: "2px", background: "linear-gradient(to right, #00f0ff, transparent)", marginTop: "16px", marginBottom: "24px" }} />
    </div>
  );

  const renderSlideRepoCard = (repo: any, rank: number, showComment: boolean = false) => {
    const bc = healthColor(repo.sustainability_label || "");
    return (
      <div key={repo.repo_id} style={{ background: "#262524", border: "1px solid #31302f", borderLeft: `5px solid ${bc}`, borderRadius: "0 8px 8px 0", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "12px", width: "100%", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ fontSize: "22px", fontWeight: 800, color: "#00f0ff", opacity: 0.6, fontFamily: "monospace" }}>#{String(rank).padStart(2, "0")}</span>
            <div style={{ fontSize: "19px", fontWeight: 700, color: "#fff" }}>{repo.owner}/<span style={{ color: "#00f0ff" }}>{repo.name}</span></div>
          </div>
          <span style={{ fontSize: "11px", color: "#bac3cc", background: "rgba(255,255,255,0.05)", padding: "3px 8px", borderRadius: "4px" }}>{repo.category}</span>
        </div>
        <p style={{ fontSize: "13.5px", color: "#bac3cc", margin: 0, lineHeight: "1.5" }}>{repo.description || "No description available."}</p>
        <div style={{ display: "flex", gap: "24px", fontSize: "12px", color: "#bac3cc" }}>
          <span>★ <b>{repo.stars?.toLocaleString()}</b> total</span>
          <span>⚡ <span style={{ color: "#d29922" }}>+{repo.star_velocity_7d?.toFixed(0)}/day</span></span>
          <span>📈 <b>{repo.acceleration?.toFixed(1)}x</b> accel</span>
        </div>
        {showComment && (
          <div style={{ borderLeft: "3px solid #00f0ff", paddingLeft: "12px", fontSize: "12px", fontStyle: "italic", color: "#bac3cc", marginTop: "4px" }}>
            <b>Analyst Note:</b> {generateInsightCommentary(repo)}
          </div>
        )}
      </div>
    );
  };

  const renderSlideRepoCompact = (repo: any, rank: number) => {
    const bc = healthColor(repo.sustainability_label || "");
    return (
      <div key={repo.repo_id} style={{ background: "#262524", border: "1px solid #31302f", borderLeft: `4px solid ${bc}`, borderRadius: "0 4px 4px 0", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: "15px", fontWeight: 800, color: "#00f0ff", opacity: 0.6, width: "30px", fontFamily: "monospace" }}>#{String(rank).padStart(2, "0")}</span>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{repo.owner}/<span style={{ color: "#00f0ff" }}>{repo.name}</span></div>
        </div>
        <div style={{ display: "flex", gap: "16px", fontSize: "12px", textAlign: "right" }}>
          <span style={{ color: "#d29922" }}>+{repo.star_velocity_7d?.toFixed(0)}/d</span>
          <span style={{ color: bc, fontWeight: 600 }}>{healthLabel(repo.sustainability_label || "")}</span>
        </div>
      </div>
    );
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');

    .wd-root {
      width: 100%;
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 24px 120px;
      box-sizing: border-box;
    }

    /* ── Masthead ── */
    .wd-masthead {
      border-bottom: 3px double var(--border);
      padding-bottom: 14px;
      margin-bottom: 22px;
      text-align: center;
    }
    .wd-pub-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(30px, 5vw, 52px);
      font-weight: 900;
      letter-spacing: -0.01em;
      color: var(--text-primary);
      line-height: 1;
      margin: 6px 0 0;
    }
    .wd-pub-sub {
      font-size: 9px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
    }
    .wd-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
    }
    .wd-edition-badge {
      font-weight: 700;
      color: var(--text-secondary);
      letter-spacing: 0.06em;
      font-size: 10px;
      text-transform: uppercase;
      background: rgba(255,255,255,0.04);
      padding: 3px 10px;
      border-radius: 3px;
      border: 1px solid var(--border);
    }

    /* ── Section label ── */
    .wd-section-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      border-bottom: 1px solid var(--border);
      padding-bottom: 7px;
      margin-bottom: 20px;
    }

    /* ── Lead ── */
    .wd-lead-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(20px, 3.5vw, 32px);
      font-weight: 900;
      line-height: 1.18;
      letter-spacing: -0.02em;
      color: var(--text-primary);
      margin: 0 0 10px;
    }
    .wd-lead-deck {
      font-size: 14.5px;
      line-height: 1.65;
      color: var(--text-secondary);
      font-family: 'Inter', sans-serif;
      margin: 0 0 14px;
      font-style: italic;
    }
    .wd-byline {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 11px;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      padding: 8px 0;
      margin-bottom: 24px;
    }
    .wd-byline-sep { opacity: 0.3; }

    /* ── Stats strip ── */
    .wd-stats-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: var(--border);
      border: 1px solid var(--border);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 32px;
    }
    @media (max-width: 600px) { .wd-stats-strip { grid-template-columns: repeat(2,1fr); } }
    .wd-stat-cell {
      background: var(--bg-surface);
      padding: 13px 18px;
      text-align: center;
    }
    .wd-stat-val { font-size: 20px; font-weight: 700; font-family: 'Inter', sans-serif; color: var(--text-primary); line-height: 1; }
    .wd-stat-key { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-top: 4px; font-family: 'Inter', sans-serif; }

    /* ── Main 2-col grid ── */
    .wd-grid { display: grid; grid-template-columns: 1fr; gap: 36px; }
    @media (min-width: 900px) { .wd-grid { grid-template-columns: 1.65fr 1fr; gap: 48px; } }

    /* ── Article cards ── */
    .wd-article { padding: 0 0 26px; border-bottom: 1px solid var(--border); }
    .wd-article:last-child { border-bottom: none; padding-bottom: 0; }
    .wd-art-rank { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px; font-family: 'Inter', sans-serif; }
    .wd-art-headline {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(16px, 2.4vw, 20px);
      font-weight: 700;
      line-height: 1.25;
      color: var(--text-primary);
      text-decoration: none;
      display: block;
      margin-bottom: 7px;
      transition: opacity 0.15s;
    }
    .wd-art-headline:hover { opacity: 0.72; }
    .wd-art-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 10.5px; color: var(--text-muted); font-family: 'Inter', sans-serif; margin-bottom: 10px; }
    .wd-art-tag { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); padding: 1px 6px; border-radius: 2px; font-size: 9px; letter-spacing: 0.05em; text-transform: uppercase; }
    .wd-art-body { font-size: 13.5px; line-height: 1.7; color: var(--text-secondary); font-family: 'Inter', sans-serif; margin: 0 0 10px; }
    .wd-metrics { display: flex; flex-wrap: wrap; gap: 14px; font-size: 11px; font-family: 'Inter', sans-serif; color: var(--text-muted); margin-bottom: 10px; }
    .wd-metric-val { font-weight: 600; color: var(--text-secondary); }
    .wd-pullquote { border-left: 3px solid rgba(255,255,255,0.1); padding: 2px 14px; margin: 0; font-size: 12.5px; line-height: 1.65; color: var(--text-muted); font-style: italic; font-family: 'Inter', sans-serif; }
    .wd-pullquote strong { font-style: normal; color: var(--text-secondary); font-weight: 600; }
    .wd-gh-link { font-size: 10px; font-weight: 600; color: var(--text-muted); text-decoration: none; letter-spacing: 0.04em; font-family: 'Inter', sans-serif; transition: color 0.15s; white-space: nowrap; }
    .wd-gh-link:hover { color: var(--text-primary); }

    /* ── Sidebar ── */
    .wd-sidebar { display: flex; flex-direction: column; gap: 0; }
    .wd-sb-block { border-top: 2px solid var(--text-muted); padding: 16px 0 20px; }
    .wd-sb-title { font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-muted); font-family: 'Inter', sans-serif; margin: 0 0 14px; }

    /* Stat cells in sidebar */
    .wd-sb-stat { margin-bottom: 12px; }
    .wd-sb-stat-val { font-size: 22px; font-weight: 700; font-family: 'Inter', sans-serif; color: var(--text-primary); line-height: 1; }
    .wd-sb-stat-key { font-size: 10px; color: var(--text-muted); margin-top: 3px; font-family: 'Inter', sans-serif; }

    /* Breakout repo rows */
    .wd-sb-repo { display: flex; align-items: flex-start; gap: 10px; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .wd-sb-repo:last-child { border-bottom: none; }
    .wd-sb-rank { font-size: 10px; font-weight: 700; color: var(--text-muted); font-family: 'Inter', sans-serif; min-width: 18px; padding-top: 1px; }
    .wd-sb-name { font-size: 12.5px; font-weight: 600; color: var(--text-primary); font-family: 'Inter', sans-serif; text-decoration: none; display: block; line-height: 1.3; transition: opacity 0.15s; }
    .wd-sb-name:hover { opacity: 0.7; }
    .wd-sb-sub { font-size: 10px; color: var(--text-muted); margin-top: 2px; font-family: 'Inter', sans-serif; }

    /* Language bar rows */
    .wd-lang-row { margin-bottom: 10px; }
    .wd-lang-label { display: flex; justify-content: space-between; font-size: 11px; font-family: 'Inter', sans-serif; color: var(--text-secondary); margin-bottom: 4px; }
    .wd-lang-bar-bg { height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
    .wd-lang-bar-fill { height: 100%; border-radius: 2px; background: linear-gradient(to right, #58a6ff, #1f6feb); }

    /* Health breakdown */
    .wd-health-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-family: 'Inter', sans-serif; }
    .wd-health-row:last-child { border-bottom: none; }

    /* Accel rows */
    .wd-accel-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .wd-accel-row:last-child { border-bottom: none; }

    /* What to watch */
    .wd-watch-card {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 6px;
      padding: 14px;
      margin-bottom: 10px;
    }
    .wd-watch-headline { font-size: 13px; font-weight: 700; color: var(--text-primary); font-family: 'Playfair Display', Georgia, serif; margin-bottom: 4px; line-height: 1.3; }
    .wd-watch-body { font-size: 11.5px; line-height: 1.6; color: var(--text-muted); font-family: 'Inter', sans-serif; }

    /* ── Nav ── */
    .wd-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; font-size: 11px; font-family: 'Inter', sans-serif; }
    .wd-nav-back { color: var(--text-muted); text-decoration: none; display: flex; align-items: center; gap: 5px; font-weight: 500; transition: color 0.15s; }
    .wd-nav-back:hover { color: var(--text-primary); }
    .wd-nav-actions { display: flex; gap: 8px; }
    .wd-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 4px; border: 1px solid var(--border); background: transparent; color: var(--text-secondary); font-size: 11px; font-weight: 600; font-family: 'Inter', sans-serif; cursor: pointer; transition: all 0.15s; }
    .wd-btn:hover { border-color: var(--text-muted); color: var(--text-primary); }
    .wd-btn-primary { background: var(--text-primary); color: var(--bg-primary); border-color: var(--text-primary); }
    .wd-btn-primary:hover { opacity: 0.85; color: var(--bg-primary); }

    /* ── Footer ── */
    .wd-footer { border-top: 3px double var(--border); padding-top: 20px; margin-top: 40px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-muted); font-family: 'Inter', sans-serif; flex-wrap: wrap; gap: 8px; }
  `;

  /* ─── render ─── */
  return (
    <div className="wd-root">
      <style>{css}</style>



      {/* ── Nav ── */}
      <div className="wd-nav">
        <Link href="/weekly" className="wd-nav-back">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" /></svg>
          All Editions
        </Link>
        <div className="wd-nav-actions">
          <button className="wd-btn" onClick={() => setIsModalOpen(true)}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export Poster
          </button>
          <button className="wd-btn" onClick={handleCopyLink}>
            {copied ? "✓ Copied" : "Copy Link"}
          </button>
        </div>
      </div>

      {/* ── Masthead ── */}
      <div className="wd-masthead">
        <p className="wd-pub-sub">The Open-Source Intelligence Brief</p>
        <h1 className="wd-pub-name">Repodar Weekly</h1>
        <p className="wd-pub-sub" style={{ marginTop: 8, letterSpacing: "0.15em" }}>AI · ML · OPEN SOURCE · DEVELOPER ECOSYSTEM</p>
        <div className="wd-top-bar">
          <span>
            {snapshot?.published_at
              ? new Date(snapshot.published_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
              : isLoading ? "Loading…" : "—"}
          </span>
          <span className="wd-edition-badge">Edition #{weekId}</span>
          <span>repodar.io</span>
        </div>
      </div>

      {/* ── Body ── */}
      {isLoading ? (
        <div style={{ padding: "24px 0" }}>
          <Skeleton shape="table" />
        </div>
      ) : error ? (
        <div style={{ fontFamily: "Inter, sans-serif", color: "var(--accent-red)", padding: "48px", fontSize: "12px", border: "1px dashed var(--border)", borderRadius: "8px", textAlign: "center" }}>
          Failed to retrieve Weekly Snapshot {weekId}. Please verify the identifier and try again.
        </div>
      ) : snapshot ? (
        <div ref={posterRef} style={{ background: "var(--bg-primary)", padding: "24px 32px 48px", borderRadius: "12px", boxSizing: "border-box" }}>
          {/* Lead */}
          <div style={{ marginBottom: 28 }}>
            <p className="wd-section-label">Top Story</p>
            <h2 className="wd-lead-title">AI &amp; ML Open-Source Momentum Report — Week {weekId}</h2>
            <p className="wd-lead-deck">
              Our telemetry engine scanned {allRepos.length || 25} repositories across the AI and Machine Learning ecosystem this week, ranking each project by star velocity, growth acceleration, and community health — surfacing the breakout projects developers are gravitating toward.
            </p>
            <div className="wd-byline">
              <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Repodar Editorial Engine</span>
              <span className="wd-byline-sep">|</span>
              <span>{snapshot.published_at ? new Date(snapshot.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}</span>
              <span className="wd-byline-sep">|</span>
              <span>5 min read</span>
              <span className="wd-byline-sep">|</span>
              <span>{allRepos.length || 25} repositories tracked</span>
            </div>
          </div>

          {/* Stats strip */}
          <div className="wd-stats-strip" style={{ marginBottom: 36 }}>
            <div className="wd-stat-cell">
              <div className="wd-stat-val">{allRepos.length || 25}</div>
              <div className="wd-stat-key">Repos Tracked</div>
            </div>
            <div className="wd-stat-cell">
              <div className="wd-stat-val" style={{ color: "#d29922" }}>+{maxVelocity.toFixed(0)}</div>
              <div className="wd-stat-key">Peak Stars/Day</div>
            </div>
            <div className="wd-stat-cell">
              <div className="wd-stat-val" style={{ color: "var(--text-secondary)" }}>{avgAccel.toFixed(1)}x</div>
              <div className="wd-stat-key">Avg Acceleration</div>
            </div>
            <div className="wd-stat-cell">
              <div className="wd-stat-val" style={{ color: "#3fb950" }}>{healthyCount}</div>
              <div className="wd-stat-key">Jonin Health</div>
            </div>
          </div>

          {/* 2-col grid */}
          <div className="wd-grid">

            {/* ── LEFT: article feed ── */}
            <div>
              <p className="wd-section-label">Featured Highlights — Ranks 1–10</p>
              {featuredRepos.map((repo) => (
                <article key={repo.repo_id} className="wd-article">
                  <div className="wd-art-rank">#{String(repo.rank).padStart(2, "0")} · Featured Breakout</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <Link href={`/repo/${repo.repo_id}`} className="wd-art-headline">
                      {repo.owner}/{repo.name}
                    </Link>
                    <a href={repo.github_url} target="_blank" rel="noopener noreferrer" className="wd-gh-link" style={{ paddingTop: 4, flexShrink: 0 }}>GitHub ↗</a>
                  </div>
                  <div className="wd-art-meta">
                    <HealthDot label={repo.sustainability_label || ""} />
                    <span style={{ color: healthColor(repo.sustainability_label || ""), fontWeight: 600, fontSize: 10 }}>{healthLabel(repo.sustainability_label || "")} Health</span>
                    {repo.category && <span className="wd-art-tag">{repo.category}</span>}
                    {repo.primary_language && <span className="wd-art-tag">{repo.primary_language}</span>}
                  </div>
                  {repo.description && <p className="wd-art-body">{repo.description}</p>}
                  <div className="wd-metrics" style={{ marginBottom: 10 }}>
                    <span>★ <span className="wd-metric-val">{repo.stars?.toLocaleString() || "—"}</span> total</span>
                    <span>⚡ <span className="wd-metric-val" style={{ color: "#d29922" }}>+{repo.star_velocity_7d?.toFixed(0)}/day</span></span>
                    <span>📈 <span className="wd-metric-val">{repo.acceleration?.toFixed(1)}x</span> accel</span>
                  </div>
                  {/* Velocity bar */}
                  <VeloBar value={repo.star_velocity_7d || 0} max={maxVelocity} />
                  <div className="wd-pullquote" style={{ marginTop: 12 }}>
                    <strong>Analyst note —</strong> {generateInsightCommentary(repo)}
                  </div>
                </article>
              ))}
            </div>

            {/* ── RIGHT: sidebar ── */}
            <div className="wd-sidebar">

              {/* 1 — This week in numbers */}
              <div className="wd-sb-block">
                <p className="wd-sb-title">This Week in Numbers</p>
                <div className="wd-sb-stat">
                  <div className="wd-sb-stat-val" style={{ color: "#d29922" }}>+{maxVelocity.toFixed(0)}</div>
                  <div className="wd-sb-stat-key">Peak star velocity (per day)</div>
                </div>
                <div className="wd-sb-stat">
                  <div className="wd-sb-stat-val">{avgAccel.toFixed(2)}x</div>
                  <div className="wd-sb-stat-key">Average acceleration across cohort</div>
                </div>
                <div className="wd-sb-stat">
                  <div className="wd-sb-stat-val" style={{ color: "#3fb950" }}>{healthyCount}</div>
                  <div className="wd-sb-stat-key">Repos with Jonin-tier health</div>
                </div>
                <div className="wd-sb-stat">
                  <div className="wd-sb-stat-val">{allRepos.length}</div>
                  <div className="wd-sb-stat-key">Total repositories scanned</div>
                </div>
              </div>

              {/* 2 — Ecosystem health breakdown */}
              <div className="wd-sb-block">
                <p className="wd-sb-title">Ecosystem Health Breakdown</p>
                <div className="wd-health-row">
                  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontFamily: "Inter, sans-serif", color: "var(--text-secondary)" }}>
                    <HealthDot label="GREEN" />Jonin (Production-Ready)
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#3fb950", fontFamily: "Inter, sans-serif" }}>{healthyCount}</span>
                </div>
                <div className="wd-health-row">
                  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontFamily: "Inter, sans-serif", color: "var(--text-secondary)" }}>
                    <HealthDot label="YELLOW" />Chunin (Monitor)
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#d29922", fontFamily: "Inter, sans-serif" }}>{yellowCount}</span>
                </div>
                <div className="wd-health-row">
                  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontFamily: "Inter, sans-serif", color: "var(--text-secondary)" }}>
                    <HealthDot label="RED" />Genin (High Risk)
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#f85149", fontFamily: "Inter, sans-serif" }}>{redCount}</span>
                </div>
                <div style={{ marginTop: 14, height: 6, borderRadius: 3, overflow: "hidden", display: "flex", gap: 2 }}>
                  {healthyCount > 0 && <div style={{ flex: healthyCount, background: "#3fb950", borderRadius: "3px 0 0 3px" }} />}
                  {yellowCount > 0 && <div style={{ flex: yellowCount, background: "#d29922" }} />}
                  {redCount > 0 && <div style={{ flex: redCount, background: "#f85149", borderRadius: "0 3px 3px 0" }} />}
                </div>
                <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "Inter, sans-serif", marginTop: 6 }}>
                  {Math.round((healthyCount / (allRepos.length || 1)) * 100)}% of tracked repos are production-safe this week.
                </p>
              </div>

              {/* 3 — Top accelerators */}
              <div className="wd-sb-block">
                <p className="wd-sb-title">Top Growth Accelerators</p>
                {topAccel.map((repo, i) => (
                  <div key={repo.repo_id} className="wd-accel-row">
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", fontFamily: "Inter, sans-serif", minWidth: 16 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/repo/${repo.repo_id}`} className="wd-sb-name" style={{ fontSize: 12 }}>
                        {repo.owner}/{repo.name}
                      </Link>
                      <div style={{ marginTop: 3, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, ((repo.acceleration || 0) / (topAccel[0]?.acceleration || 1)) * 100)}%`, background: "linear-gradient(to right, #58a6ff, #1f6feb)", borderRadius: 2 }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#58a6ff", fontFamily: "Inter, sans-serif", flexShrink: 0 }}>{repo.acceleration?.toFixed(1)}x</span>
                  </div>
                ))}
              </div>

              {/* 4 — Language distribution */}
              {topLangs.length > 0 && (
                <div className="wd-sb-block">
                  <p className="wd-sb-title">Language Distribution</p>
                  {topLangs.map(([lang, count]) => (
                    <div key={lang} className="wd-lang-row">
                      <div className="wd-lang-label">
                        <span>{lang}</span>
                        <span style={{ color: "var(--text-muted)" }}>{count} repo{count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="wd-lang-bar-bg">
                        <div className="wd-lang-bar-fill" style={{ width: `${Math.round((count / (topLangs[0][1] || 1)) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 5 — Most starred projects */}
              <div className="wd-sb-block">
                <p className="wd-sb-title">Most Established Projects</p>
                {topByStars.map((repo, i) => (
                  <div key={repo.repo_id} className="wd-sb-repo">
                    <span className="wd-sb-rank">{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/repo/${repo.repo_id}`} className="wd-sb-name">{repo.owner}/{repo.name}</Link>
                      <div className="wd-sb-sub">
                        ★ {repo.stars?.toLocaleString() || "—"} total stars
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 6 — Category breakdown */}
              {topCats.length > 0 && (
                <div className="wd-sb-block">
                  <p className="wd-sb-title">Category Breakdown</p>
                  {topCats.map(([cat, count]) => (
                    <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontFamily: "Inter, sans-serif" }}>
                      <span style={{ fontSize: 11.5, color: "var(--text-secondary)", textTransform: "capitalize" }}>{cat.toLowerCase()}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", padding: "1px 7px", borderRadius: 3, fontWeight: 600 }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 7 — Also Trending (11+) */}
              {secondaryRepos.length > 0 && (
                <div className="wd-sb-block">
                  <p className="wd-sb-title">Also Trending — Ranks 11–{10 + secondaryRepos.length}</p>
                  {secondaryRepos.map((repo) => (
                    <div key={repo.repo_id} className="wd-sb-repo">
                      <span className="wd-sb-rank">#{repo.rank}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link href={`/repo/${repo.repo_id}`} className="wd-sb-name">{repo.owner}/{repo.name}</Link>
                        <div className="wd-sb-sub">
                          <HealthDot label={repo.sustainability_label || ""} />
                          {repo.primary_language || "Other"} · <span style={{ color: "#d29922", fontWeight: 600 }}>+{repo.star_velocity_7d?.toFixed(0)}/d</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 8 — What to watch editorial */}
              <div className="wd-sb-block">
                <p className="wd-sb-title">What to Watch</p>
                {featuredRepos.slice(0, 2).map((repo) => (
                  <div key={repo.repo_id} className="wd-watch-card">
                    <div className="wd-watch-headline">{repo.name}</div>
                    <p className="wd-watch-body">
                      {repo.acceleration && repo.acceleration > 1.5
                        ? `Unusually high ${repo.acceleration.toFixed(1)}x acceleration suggests a major event may be driving attention. Worth tracking closely over the next 48–72 hours.`
                        : `Stable growth at +${repo.star_velocity_7d?.toFixed(0)} stars/day. A long-term candidate for production evaluation.`}
                    </p>
                  </div>
                ))}
              </div>

              {/* 9 — About */}
              <div className="wd-sb-block">
                <p className="wd-sb-title">About This Digest</p>
                <p style={{ fontSize: 11.5, lineHeight: 1.7, color: "var(--text-muted)", fontFamily: "Inter, sans-serif", margin: 0 }}>
                  Repodar continuously monitors open-source repository signals — tracking star velocity, acceleration, and community health — to surface the most significant AI/ML projects before they go mainstream.
                </p>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="wd-footer">
            <span>© {new Date().getFullYear()} Repodar Intelligence System — automated analysis, not human editorial</span>
            <span>repodar.io · Edition #{weekId}</span>
          </div>
        </div>
      ) : null}

      {/* ── Hidden LinkedIn Carousel Pages for Export ── */}
      <div ref={carouselRef} style={{ position: "absolute", left: "-9999px", top: "-9999px" }} className="wd-root">
        {/* Slide 1: Cover */}
        <div data-page-index="1" style={slideStyle}>
          <div>
            {renderSlideHeader("Ecosystem Telemetry", 1)}
            <div className="wd-masthead" style={{ marginTop: "40px", borderBottom: "none", paddingBottom: "0px", marginBottom: "0px" }}>
              <p className="wd-pub-sub">AUTOMATED SNAPSHOT INTELLIGENCE</p>
              <h1 className="wd-pub-name" style={{ fontSize: "52px", lineHeight: "1.1", margin: "16px 0" }}>Weekly AI/ML Radar</h1>
              <div className="wd-top-bar" style={{ borderTop: "none", marginTop: "0px", paddingTop: "0px" }}>
                <span>Ecosystem Telemetry Digest</span>
                <span className="wd-edition-badge">Edition #{weekId}</span>
              </div>
            </div>

            <div style={{ marginTop: "40px" }}>
              <h2 className="wd-lead-title" style={{ fontSize: "32px", marginBottom: "16px" }}>Ecosystem Breakthroughs</h2>
              <p className="wd-lead-deck" style={{ fontSize: "15px", lineHeight: "1.6" }}>
                Automated intelligence telemetry capturing the highest velocity open-source projects, community health metrics, and growth acceleration.
              </p>
            </div>

            <div className="wd-stats-strip" style={{ marginTop: "40px", marginBottom: "0px" }}>
              <div className="wd-stat-cell">
                <div className="wd-stat-val">{allRepos.length}</div>
                <div className="wd-stat-key">Repos Tracked</div>
              </div>
              <div className="wd-stat-cell">
                <div className="wd-stat-val">+{maxVelocity.toFixed(0)}</div>
                <div className="wd-stat-key">Peak Stars/d</div>
              </div>
              <div className="wd-stat-cell">
                <div className="wd-stat-val">{avgAccel.toFixed(1)}x</div>
                <div className="wd-stat-key">Avg Accel</div>
              </div>
              <div className="wd-stat-cell">
                <div className="wd-stat-val">{healthyCount}</div>
                <div className="wd-stat-key">Healthy</div>
              </div>
            </div>
          </div>
          {renderSlideFooter(1)}
        </div>

        {/* Slide 2: Spotlight #1 */}
        <div data-page-index="2" style={slideStyle}>
          <div>
            {renderSlideHeader("Ecosystem Spotlight", 2)}
            {featuredRepos[0] && (
              <div className="wd-article" style={{ borderBottom: "none", paddingBottom: 0, marginTop: "24px" }}>
                <div className="wd-art-rank">Rank #01 / Breakout Champion</div>
                <h3 className="wd-art-headline" style={{ fontSize: "36px", margin: "12px 0" }}>
                  {featuredRepos[0].owner}/<span style={{ color: "#00f0ff" }}>{featuredRepos[0].name}</span>
                </h3>
                <div className="wd-art-meta" style={{ fontSize: "13px", marginBottom: "16px" }}>
                  <span className="wd-art-tag" style={{ fontSize: "11px", padding: "3px 8px" }}>{featuredRepos[0].category}</span>
                  <span>•</span>
                  <span>{featuredRepos[0].primary_language || "TypeScript"}</span>
                </div>
                <p className="wd-art-body" style={{ fontSize: "16px", lineHeight: "1.7", marginBottom: "24px" }}>
                  {featuredRepos[0].description}
                </p>
                <div className="wd-metrics" style={{ fontSize: "13px", gap: "24px", marginBottom: "24px" }}>
                  <span>Total Stars: <span className="wd-metric-val">{featuredRepos[0].stars?.toLocaleString()}</span></span>
                  <span>Velocity: <span className="wd-metric-val">+{featuredRepos[0].star_velocity_7d?.toFixed(0)}/day</span></span>
                  <span>Acceleration: <span className="wd-metric-val">{featuredRepos[0].acceleration?.toFixed(1)}x</span></span>
                </div>
                <blockquote className="wd-pullquote" style={{ fontSize: "14px", lineHeight: "1.65", padding: "8px 18px", borderLeft: "3px solid #00f0ff" }}>
                  <strong>Analyst Note:</strong> {generateInsightCommentary(featuredRepos[0])}
                </blockquote>
              </div>
            )}
          </div>
          {renderSlideFooter(2)}
        </div>

        {/* Slide 3: Ranks #2-#3 */}
        <div data-page-index="3" style={slideStyle}>
          <div>
            {renderSlideHeader("Featured Breakthroughs", 3)}
            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "32px" }}>
              {featuredRepos[1] && (
                <div className="wd-article" style={{ borderBottom: "none", paddingBottom: 0 }}>
                  <div className="wd-art-rank">Rank #02</div>
                  <h3 className="wd-art-headline" style={{ fontSize: "24px", margin: "8px 0" }}>
                    {featuredRepos[1].owner}/<span style={{ color: "#00f0ff" }}>{featuredRepos[1].name}</span>
                  </h3>
                  <div className="wd-art-meta">
                    <span className="wd-art-tag">{featuredRepos[1].category}</span>
                    <span>•</span>
                    <span>{featuredRepos[1].primary_language || "Python"}</span>
                  </div>
                  <p className="wd-art-body" style={{ fontSize: "14px", lineHeight: "1.6" }}>{featuredRepos[1].description}</p>
                  <div className="wd-metrics">
                    <span>Stars: <span className="wd-metric-val">{featuredRepos[1].stars?.toLocaleString()}</span></span>
                    <span>Velocity: <span className="wd-metric-val">+{featuredRepos[1].star_velocity_7d?.toFixed(0)}/day</span></span>
                    <span>Acceleration: <span className="wd-metric-val">{featuredRepos[1].acceleration?.toFixed(1)}x</span></span>
                  </div>
                </div>
              )}
              
              {featuredRepos[2] && (
                <div className="wd-article" style={{ borderBottom: "none", paddingBottom: 0, borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
                  <div className="wd-art-rank">Rank #03</div>
                  <h3 className="wd-art-headline" style={{ fontSize: "24px", margin: "8px 0" }}>
                    {featuredRepos[2].owner}/<span style={{ color: "#00f0ff" }}>{featuredRepos[2].name}</span>
                  </h3>
                  <div className="wd-art-meta">
                    <span className="wd-art-tag">{featuredRepos[2].category}</span>
                    <span>•</span>
                    <span>{featuredRepos[2].primary_language || "Python"}</span>
                  </div>
                  <p className="wd-art-body" style={{ fontSize: "14px", lineHeight: "1.6" }}>{featuredRepos[2].description}</p>
                  <div className="wd-metrics">
                    <span>Stars: <span className="wd-metric-val">{featuredRepos[2].stars?.toLocaleString()}</span></span>
                    <span>Velocity: <span className="wd-metric-val">+{featuredRepos[2].star_velocity_7d?.toFixed(0)}/day</span></span>
                    <span>Acceleration: <span className="wd-metric-val">{featuredRepos[2].acceleration?.toFixed(1)}x</span></span>
                  </div>
                </div>
              )}
            </div>
          </div>
          {renderSlideFooter(3)}
        </div>

        {/* Slide 4: Ranks #4-#5 */}
        <div data-page-index="4" style={slideStyle}>
          <div>
            {renderSlideHeader("Featured Breakthroughs", 4)}
            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "32px" }}>
              {featuredRepos[3] && (
                <div className="wd-article" style={{ borderBottom: "none", paddingBottom: 0 }}>
                  <div className="wd-art-rank">Rank #04</div>
                  <h3 className="wd-art-headline" style={{ fontSize: "24px", margin: "8px 0" }}>
                    {featuredRepos[3].owner}/<span style={{ color: "#00f0ff" }}>{featuredRepos[3].name}</span>
                  </h3>
                  <div className="wd-art-meta">
                    <span className="wd-art-tag">{featuredRepos[3].category}</span>
                    <span>•</span>
                    <span>{featuredRepos[3].primary_language || "Python"}</span>
                  </div>
                  <p className="wd-art-body" style={{ fontSize: "14px", lineHeight: "1.6" }}>{featuredRepos[3].description}</p>
                  <div className="wd-metrics">
                    <span>Stars: <span className="wd-metric-val">{featuredRepos[3].stars?.toLocaleString()}</span></span>
                    <span>Velocity: <span className="wd-metric-val">+{featuredRepos[3].star_velocity_7d?.toFixed(0)}/day</span></span>
                    <span>Acceleration: <span className="wd-metric-val">{featuredRepos[3].acceleration?.toFixed(1)}x</span></span>
                  </div>
                </div>
              )}
              
              {featuredRepos[4] && (
                <div className="wd-article" style={{ borderBottom: "none", paddingBottom: 0, borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
                  <div className="wd-art-rank">Rank #05</div>
                  <h3 className="wd-art-headline" style={{ fontSize: "24px", margin: "8px 0" }}>
                    {featuredRepos[4].owner}/<span style={{ color: "#00f0ff" }}>{featuredRepos[4].name}</span>
                  </h3>
                  <div className="wd-art-meta">
                    <span className="wd-art-tag">{featuredRepos[4].category}</span>
                    <span>•</span>
                    <span>{featuredRepos[4].primary_language || "Python"}</span>
                  </div>
                  <p className="wd-art-body" style={{ fontSize: "14px", lineHeight: "1.6" }}>{featuredRepos[4].description}</p>
                  <div className="wd-metrics">
                    <span>Stars: <span className="wd-metric-val">{featuredRepos[4].stars?.toLocaleString()}</span></span>
                    <span>Velocity: <span className="wd-metric-val">+{featuredRepos[4].star_velocity_7d?.toFixed(0)}/day</span></span>
                    <span>Acceleration: <span className="wd-metric-val">{featuredRepos[4].acceleration?.toFixed(1)}x</span></span>
                  </div>
                </div>
              )}
            </div>
          </div>
          {renderSlideFooter(4)}
        </div>

        {/* Slide 5: Ranks #6-#10 */}
        <div data-page-index="5" style={slideStyle}>
          <div>
            {renderSlideHeader("Ecosystem Rankings", 5)}
            <div className="wd-sidebar" style={{ marginTop: "24px" }}>
              <div className="wd-sb-block" style={{ borderTop: "none", paddingTop: 0 }}>
                <p className="wd-sb-title">Ranks 06 - 10</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {featuredRepos.slice(5, 10).map((repo, idx) => {
                    const bc = healthColor(repo.sustainability_label || "");
                    return (
                      <div key={repo.repo_id} style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                        <span className="wd-sb-rank">#{String(6 + idx).padStart(2, "0")}</span>
                        <div style={{ flex: 1 }}>
                          <span className="wd-sb-name">{repo.owner}/{repo.name}</span>
                          <div className="wd-sb-sub" style={{ display: "flex", gap: "10px" }}>
                            <span>★ {repo.stars?.toLocaleString()}</span>
                            <span>⚡ +{repo.star_velocity_7d?.toFixed(0)}/day</span>
                            <span style={{ color: bc, fontWeight: 700 }}>{healthLabel(repo.sustainability_label || "")}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          {renderSlideFooter(5)}
        </div>

        {/* Slide 6: Charts */}
        <div data-page-index="6" style={slideStyle}>
          <div>
            {renderSlideHeader("Ecosystem Analytics", 6)}
            <div className="wd-sidebar" style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
                
                {/* Languages */}
                <div className="wd-sb-block" style={{ borderTop: "2px solid var(--text-muted)", paddingTop: "12px" }}>
                  <p className="wd-sb-title">Language Distribution</p>
                  {topLangs.slice(0, 4).map(([lang, count]) => {
                    const pct = Math.round((count / (topLangs[0][1] || 1)) * 100);
                    return (
                      <div key={lang} className="wd-lang-row">
                        <div className="wd-lang-label">
                          <span>{lang}</span>
                          <span>{count} repos</span>
                        </div>
                        <div className="wd-lang-bar-bg">
                          <div className="wd-lang-bar-fill" style={{ width: `${pct}%`, background: "linear-gradient(to right, #00f0ff, #0072ff)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Accel */}
                <div className="wd-sb-block" style={{ borderTop: "2px solid var(--text-muted)", paddingTop: "12px" }}>
                  <p className="wd-sb-title">Growth Acceleration</p>
                  {topAccel.slice(0, 4).map((repo) => (
                    <div key={repo.repo_id} className="wd-accel-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="wd-sb-name" style={{ fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>
                        {repo.name}
                      </span>
                      <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: "#00f0ff" }}>
                        {repo.acceleration?.toFixed(1)}x
                      </span>
                    </div>
                  ))}
                </div>

              </div>

              {/* Health cohort */}
              <div className="wd-sb-block" style={{ borderTop: "2px solid var(--text-muted)", paddingTop: "12px" }}>
                <p className="wd-sb-title">Ecosystem Cohort Health</p>
                <div style={{ display: "flex", height: "8px", borderRadius: "999px", overflow: "hidden", gap: "2px", margin: "12px 0 8px", background: "rgba(255,255,255,0.06)" }}>
                  {healthyCount > 0 && <div style={{ flex: healthyCount, background: "#3fb950" }} />}
                  {yellowCount > 0 && <div style={{ flex: yellowCount, background: "#d29922" }} />}
                  {redCount > 0 && <div style={{ flex: redCount, background: "#f85149" }} />}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                  <span>🟢 Jonin ({healthyCount})</span>
                  <span>🟡 Chunin ({yellowCount})</span>
                  <span>🔴 Genin ({redCount})</span>
                </div>
              </div>

            </div>
          </div>
          {renderSlideFooter(6)}
        </div>

        {/* Slide 7: Ecosystem Momentum */}
        <div data-page-index="7" style={slideStyle}>
          <div>
            {renderSlideHeader("Ecosystem Momentum", 7)}
            <div className="wd-sidebar" style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
                
                {/* Also Trending */}
                <div className="wd-sb-block" style={{ borderTop: "2px solid var(--text-muted)", paddingTop: "12px" }}>
                  <p className="wd-sb-title">Also Trending (Ranks 11-17)</p>
                  {secondaryRepos.slice(0, 7).map((item) => (
                    <div key={item.repo_id} className="wd-accel-row" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="wd-sb-name" style={{ fontSize: "11.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>
                        #{item.rank} {item.name}
                      </span>
                      <span style={{ fontSize: "11px", color: "#d29922", fontWeight: 700 }}>
                        +{item.star_velocity_7d?.toFixed(0)}/d
                      </span>
                    </div>
                  ))}
                </div>

                {/* Watch List */}
                <div className="wd-sb-block" style={{ borderTop: "2px solid var(--text-muted)", paddingTop: "12px" }}>
                  <p className="wd-sb-title">Alert Watch List</p>
                  {watchList.slice(0, 4).map((item) => (
                    <div key={item.repo_id} className="wd-watch-card" style={{ marginBottom: "8px", padding: "10px" }}>
                      <div className="wd-watch-headline" style={{ fontSize: "12px" }}>{item.name}</div>
                      <div className="wd-watch-body" style={{ fontSize: "10.5px" }}>{healthLabel(item.sustainability_label || "")} Risk status alert.</div>
                    </div>
                  ))}
                </div>

              </div>

              <div className="wd-article" style={{ borderBottom: "none", paddingBottom: 0 }}>
                <blockquote className="wd-pullquote" style={{ fontSize: "13px", lineHeight: "1.6" }}>
                  <strong>Ecosystem Report Overview:</strong> Our telemetry scanned {allRepos.length} AI and ML repositories this week, ranking projects by velocity and health.
                </blockquote>
              </div>
            </div>
          </div>
          {renderSlideFooter(7)}
        </div>

        {/* Slide 8: About & Methodology */}
        <div data-page-index="8" style={slideStyle}>
          <div>
            {renderSlideHeader("About & Methodology", 8)}
            <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "36px" }}>
              <div>
                <h2 className="wd-lead-title" style={{ fontSize: "28px", marginBottom: "12px" }}>Ecosystem Scoring Methodology</h2>
                <p className="wd-lead-deck" style={{ fontSize: "14.5px", lineHeight: "1.6" }}>
                  Repodar scores ecosystem sustainability using issue resolution speed, release frequency, license types, and commit volume.
                </p>
              </div>

              <div className="wd-stats-strip" style={{ gridTemplateColumns: "1fr 1fr", gap: "1px", marginBottom: 0 }}>
                <div className="wd-stat-cell" style={{ padding: "20px" }}>
                  <div className="wd-stat-val" style={{ fontSize: "16px" }}>repodar.io</div>
                  <div className="wd-stat-key">Telemetry Platform</div>
                </div>
                <div className="wd-stat-cell" style={{ padding: "20px" }}>
                  <div className="wd-stat-val" style={{ fontSize: "16px" }}>saikumargudelly/repodar</div>
                  <div className="wd-stat-key">GitHub Repository</div>
                </div>
              </div>

              <blockquote className="wd-pullquote" style={{ textAlign: "center", borderLeft: "none", padding: "0 24px", fontSize: "13px" }}>
                "Automated analysis, not human editorial."
              </blockquote>
            </div>
          </div>
          {renderSlideFooter(8)}
        </div>
      </div>

      {/* ── Export Modal ── */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,13,20,0.88)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px", boxSizing: "border-box" }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", width: "100%", maxWidth: "560px", padding: "28px", display: "flex", flexDirection: "column", gap: "18px", boxShadow: "0 24px 48px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--text-primary)", fontFamily: "Inter, sans-serif" }}>Weekly Report Publisher</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", fontFamily: "Inter, sans-serif" }}>Choose export layout format and output target</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}>✕</button>
            </div>
            
            {exportProgress ? (
              <div style={{ border: "1px solid var(--border)", background: "var(--bg-primary)", borderRadius: "8px", padding: "32px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
                <span style={{ fontSize: "32px", animation: "spin 2s linear infinite" }}>⏳</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textAlign: "center", fontFamily: "Inter, sans-serif" }}>
                  {exportProgress}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div 
                  onClick={handleExportSinglePage}
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "8px", padding: "16px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer", transition: "background 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                >
                  <span style={{ fontSize: "28px" }}>📄</span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", fontFamily: "Inter, sans-serif" }}>Single Full Page (4K PNG)</div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "Inter, sans-serif", marginTop: "2px" }}>Exports the entire weekly blog page UI as a single tall high-resolution graphic.</div>
                  </div>
                </div>

                <div 
                  onClick={handleExportPoster}
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "8px", padding: "16px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer", transition: "background 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                >
                  <span style={{ fontSize: "28px" }}>🗂️</span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", fontFamily: "Inter, sans-serif" }}>LinkedIn Carousel Pack (8 PNGs)</div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "Inter, sans-serif", marginTop: "2px" }}>8 separate portrait slides (1080×1350) + manifest.json metadata package.</div>
                  </div>
                </div>

                <div 
                  onClick={handleExportPDF}
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "8px", padding: "16px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer", transition: "background 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                >
                  <span style={{ fontSize: "28px" }}>📕</span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", fontFamily: "Inter, sans-serif" }}>PDF Document (8-Page PDF)</div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "Inter, sans-serif", marginTop: "2px" }}>Compiles the 8 portrait layout pages into a single printable PDF file.</div>
                  </div>
                </div>

                <div 
                  onClick={handleShareToLinkedIn}
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "8px", padding: "16px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer", transition: "background 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                >
                  <span style={{ fontSize: "28px" }}>🔗</span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", fontFamily: "Inter, sans-serif" }}>Share Carousel to LinkedIn</div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "Inter, sans-serif", marginTop: "2px" }}>Pre-fills LinkedIn post with statistics and copies Slide 1 cover image to your clipboard.</div>
                  </div>
                </div>
              </div>
            )}
            
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button onClick={() => setIsModalOpen(false)} disabled={exporting} className="wd-btn" style={{ padding: "10px 16px", fontSize: 13, borderRadius: 6, width: "100%", justifyContent: "center" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
