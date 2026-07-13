"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useEffect, useState, useMemo } from "react";
import { api, SnapshotDetail } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

// publishing engine imports
import { normalizeWeeklyReport } from "@/lib/report/models/reportModel";
import { composePresentationModel } from "@/lib/report/presentation/presentationComposer";
import { generatePages } from "@/lib/report/layout/layoutEngine";
import { WebRenderer } from "@/lib/report/renderers/webRenderer";
import { PortraitCarouselRenderer } from "@/lib/report/renderers/portraitCarouselRenderer";
import { ExportService, ExportProgress } from "@/lib/report/export/exportService";
import { defaultTheme } from "@/lib/report/theme";

export default function WeeklyDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = use(params);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);

  const [webContent, setWebContent] = useState<React.ReactNode>(null);
  const [carouselSlides, setCarouselSlides] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    if (weekId) {
      document.title = `Repodar Weekly Digest: ${weekId} | AI/ML Ecosystem Radar`;
    }
  }, [weekId]);

  const { data: snapshot, isLoading, error } = useQuery<SnapshotDetail>({
    queryKey: ["snapshot", weekId],
    queryFn: () => api.getSnapshot(weekId),
    enabled: !!weekId,
  });

  // 1. Data Normalization (computes only normalized facts)
  const report = useMemo(() => {
    return snapshot ? normalizeWeeklyReport(snapshot) : null;
  }, [snapshot]);

  // 2. Presentation Composition (narrative model)
  const presentation = useMemo(() => {
    return report ? composePresentationModel(report) : null;
  }, [report]);

  // 3. Layout engine pagination
  const pages = useMemo(() => {
    return presentation ? generatePages(presentation) : [];
  }, [presentation]);

  // 4. Render interactive Web view
  useEffect(() => {
    if (pages.length > 0) {
      const webRenderer = new WebRenderer();
      const context = {
        width: 1280,
        height: 0,
        dpi: 1,
        theme: defaultTheme,
        branding: {
          name: "Repodar",
          logoUrl: "",
          websiteUrl: "repodar.io",
          githubUrl: "github.com/saikumargudelly/repodar",
          slogan: "Automated analysis, not human editorial"
        },
        quality: 1.0,
        outputFormat: "png" as const
      };
      webRenderer.render(pages, context).then(res => setWebContent(res));
    }
  }, [pages]);

  // 5. Render Portrait Carousel Slides (1080x1350 px)
  useEffect(() => {
    if (pages.length > 0) {
      const carouselRenderer = new PortraitCarouselRenderer();
      const context = {
        width: 1080,
        height: 1350,
        dpi: 3.2, // High resolution crisp export (4K equivalent width)
        theme: defaultTheme,
        branding: {
          name: "Repodar",
          logoUrl: "",
          websiteUrl: "repodar.io",
          githubUrl: "github.com/saikumargudelly/repodar",
          slogan: "Automated analysis, not human editorial"
        },
        quality: 1.0,
        outputFormat: "png" as const
      };
      carouselRenderer.render(pages, context).then(res => setCarouselSlides(res));
    }
  }, [pages]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportCarousel = async () => {
    if (pages.length === 0) return;
    setExporting(true);
    setExportProgress({
      total: pages.length,
      current: 0,
      stage: "rendering",
      message: "Initializing export engine..."
    });

    const context = {
      width: 1080,
      height: 1350,
      dpi: 3.2,
      theme: defaultTheme,
      branding: {
        name: "Repodar",
        logoUrl: "",
        websiteUrl: "repodar.io",
        githubUrl: "github.com/saikumargudelly/repodar",
        slogan: "Automated analysis, not human editorial"
      },
      quality: 1.0,
      outputFormat: "png" as const
    };

    try {
      await ExportService.exportCarousel(
        pages,
        context,
        "repodar-carousel-export-container",
        (prog) => setExportProgress(prog)
      );
    } catch (err) {
      console.error("Failed to generate carousel pages", err);
    } finally {
      setExporting(false);
    }
  };

  const css = `
    .wd-root {
      width: 100%;
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 24px 120px;
      box-sizing: border-box;
    }
    .wd-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; font-size: 11px; font-family: 'Inter', sans-serif; }
    .wd-nav-back { color: var(--text-muted); text-decoration: none; display: flex; align-items: center; gap: 5px; font-weight: 500; transition: color 0.15s; }
    .wd-nav-back:hover { color: var(--text-primary); }
    .wd-nav-actions { display: flex; gap: 8px; }
    .wd-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 4px; border: 1px solid var(--border); background: transparent; color: var(--text-secondary); font-size: 11px; font-weight: 600; font-family: 'Inter', sans-serif; cursor: pointer; transition: all 0.15s; }
    .wd-btn:hover { border-color: var(--text-muted); color: var(--text-primary); }
    .wd-btn-primary { background: var(--text-primary); color: var(--bg-primary); border-color: var(--text-primary); }
    .wd-btn-primary:hover { opacity: 0.85; color: var(--bg-primary); }
  `;

  return (
    <div className="wd-root">
      <style>{css}</style>

      {/* Hidden container where high-res portrait slides are rendered for ExportService */}
      <div id="repodar-carousel-export-container" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        {carouselSlides}
      </div>

      {/* Navigation bar */}
      <div className="wd-nav">
        <Link href="/weekly" className="wd-nav-back">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" /></svg>
          All Editions
        </Link>
        <div className="wd-nav-actions">
          <button className="wd-btn" onClick={() => setIsModalOpen(true)}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export Carousel
          </button>
          <button className="wd-btn" onClick={handleCopyLink}>
            {copied ? "✓ Copied" : "Copy Link"}
          </button>
        </div>
      </div>

      {/* Main Layout Area */}
      {isLoading ? (
        <div style={{ padding: "24px 0" }}>
          <Skeleton shape="table" />
        </div>
      ) : error ? (
        <div style={{ fontFamily: "Inter, sans-serif", color: "var(--accent-red)", padding: "48px", fontSize: "12px", border: "1px dashed var(--border)", borderRadius: "8px", textAlign: "center" }}>
          Failed to retrieve Weekly Snapshot {weekId}. Please verify the identifier and try again.
        </div>
      ) : webContent ? (
        webContent
      ) : null}

      {/* Export Modal */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,13,20,0.88)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px", boxSizing: "border-box" }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", width: "100%", maxWidth: "560px", padding: "28px", display: "flex", flexDirection: "column", gap: "18px", boxShadow: "0 24px 48px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--text-primary)", fontFamily: "Inter, sans-serif" }}>Publishing Engine</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", fontFamily: "Inter, sans-serif" }}>High-resolution Multi-page Portrait Carousel Export</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}>✕</button>
            </div>
            
            <div style={{ border: "1px solid var(--border)", background: "var(--bg-primary)", borderRadius: "8px", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
              <div style={{ width: 240, height: 160, border: "1px dashed var(--border)", borderRadius: 6, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>📄</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
                  {exporting ? "Rendering Pages..." : `${pages.length} Dynamic Pages Prepared`}
                </span>
              </div>
            </div>

            {exportProgress ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)" }}>
                  <span>{exportProgress.message}</span>
                  {exportProgress.stage !== "complete" && exportProgress.stage !== "error" && (
                    <span>{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
                  )}
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(exportProgress.current / exportProgress.total) * 100}%`,
                    background: exportProgress.stage === "error" ? "var(--accent-red)" : "var(--text-primary)",
                    borderRadius: 2
                  }} />
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}>
                Exports the entire weekly snapshot as a multi-page portrait carousel of <strong>1080×1350 px</strong> (at 3.2× scaling for high-res 4K equivalent) plus a structured <strong>manifest.json</strong> metadata package.
              </p>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleExportCarousel} disabled={exporting} className="wd-btn wd-btn-primary" style={{ flex: 1, padding: "10px 0", fontSize: 13, justifyContent: "center", borderRadius: 6 }}>
                {exporting ? "⏳ Rendering..." : "📥 Download Carousel Pack"}
              </button>
              <button onClick={() => setIsModalOpen(false)} className="wd-btn" style={{ padding: "10px 16px", fontSize: 13, borderRadius: 6 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
