import React from "react";
import Link from "next/link";
import { Page, RenderContext, ReportRenderer } from "../types";
import { FeaturedRepositoryCard } from "../components/FeaturedRepositoryCard";
import { CompactRepositoryCard } from "../components/CompactRepositoryCard";
import { Footer } from "../components/Footer";
import { ReportHeader } from "../components/ReportHeader";
import { MetricCards } from "../components/MetricCards";
import { SectionHeader } from "../components/SectionHeader";
import { SidebarMetric } from "../components/SidebarMetric";
import { ChartCard } from "../components/ChartCard";

export class WebRenderer implements ReportRenderer<React.ReactNode> {
  async render(pages: Page[], context: RenderContext): Promise<React.ReactNode> {
    const theme = context.theme;

    // Find the Cover page data
    const coverPage = pages.find(p => p.type === "cover");
    const coverProps = coverPage?.components[0]?.props || {};

    // Find all featured repo cards
    const largeRepoPage = pages.find(p => p.type === "featured-repo-large");
    const mediumRepoPages = pages.filter(p => p.type === "featured-repos-medium");
    const compactRepoPages = pages.filter(p => p.type === "featured-repos-compact");

    const largeCard = largeRepoPage?.components[0]?.props?.card;
    const mediumCards = mediumRepoPages.flatMap(p => p.components[0]?.props?.cards || []);
    const compactCards = compactRepoPages.flatMap(p => p.components[0]?.props?.cards || []);

    const allFeatured = [
      ...(largeCard ? [largeCard] : []),
      ...mediumCards,
      ...compactCards
    ];

    // Find charts page data
    const chartsPage = pages.find(p => p.type === "charts");
    const chartsProps = chartsPage?.components[0]?.props?.charts || {};

    // Find trending-watchlist page data
    const trendingPage = pages.find(p => p.type === "trending-watchlist");
    const trendingProps = trendingPage?.components[0]?.props || {};

    // Find about page data
    const aboutPage = pages.find(p => p.type === "about");
    const aboutProps = aboutPage?.components[0]?.props?.about || {};

    const maxVelocity = allFeatured.length ? Math.max(...allFeatured.map(c => c.repo.star_velocity_7d || 0)) : 1000;

    return (
      <div style={{
        width: "100%",
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "0 24px 120px",
        boxSizing: "border-box",
        background: theme.colors.bgPrimary,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamilySans
      }}>
        {/* Navigation spacer */}
        <div style={{ height: "40px" }} />

        {/* Masthead */}
        <div style={{
          borderBottom: `3px double ${theme.colors.border}`,
          paddingBottom: "14px",
          marginBottom: "22px",
          textAlign: "center"
        }}>
          <p style={{
            fontSize: "11px",
            fontWeight: theme.typography.fontWeightSemiBold,
            color: theme.colors.accentCyan,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            margin: 0
          }}>The Open-Source Intelligence Brief</p>
          <h1 style={{
            fontFamily: theme.typography.fontFamilySerif,
            fontSize: "48px",
            fontWeight: theme.typography.fontWeightBold,
            color: theme.colors.textPrimary,
            margin: "8px 0"
          }}>Repodar Weekly</h1>
          <p style={{
            fontSize: "11px",
            fontWeight: theme.typography.fontWeightSemiBold,
            color: theme.colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            margin: "8px 0 0"
          }}>AI · ML · OPEN SOURCE · DEVELOPER ECOSYSTEM</p>
          
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "16px",
            fontSize: "12px",
            color: theme.colors.textSecondary,
            fontFamily: theme.typography.fontFamilyMono,
            borderTop: `1px solid ${theme.colors.border}`,
            paddingTop: "12px"
          }}>
            <span>{coverProps.publishedDateText || "—"}</span>
            <span style={{
              background: "rgba(255,255,255,0.06)",
              padding: "2px 8px",
              borderRadius: theme.radius.sm,
              fontWeight: theme.typography.fontWeightBold
            }}>Edition #{coverProps.weekId}</span>
            <span>repodar.io</span>
          </div>
        </div>

        {/* Lead Section */}
        {trendingProps.editorial && (
          <div style={{ marginBottom: "28px" }}>
            <SectionHeader label="Top Story" theme={theme} />
            <h2 style={{
              fontSize: theme.typography.fontSizeTitleMedium,
              fontWeight: theme.typography.fontWeightExtraBold,
              color: theme.colors.textPrimary,
              margin: "8px 0",
              fontFamily: theme.typography.fontFamilySans
            }}>{trendingProps.editorial.leadTitle}</h2>
            <p style={{
              fontSize: "15px",
              color: theme.colors.textSecondary,
              lineHeight: "1.6",
              margin: "0 0 12px 0",
              fontFamily: theme.typography.fontFamilySans
            }}>{trendingProps.editorial.leadBody}</p>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "11px",
              color: theme.colors.textSecondary,
              fontFamily: theme.typography.fontFamilyMono
            }}>
              <span>{trendingProps.editorial.bylineText}</span>
            </div>
          </div>
        )}

        {/* Stats Strip */}
        <div style={{ marginBottom: "36px" }}>
          <MetricCards metrics={coverProps.heroMetrics || []} theme={theme} />
        </div>

        {/* Grid Area */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "36px",
          width: "100%"
        }}>
          {/* Responsive CSS for desktop 2-column grid */}
          <style>{`
            @media (min-width: 1024px) {
              .wd-web-grid {
                display: grid !important;
                grid-template-columns: 2fr 1fr !important;
                gap: 36px !important;
              }
            }
          `}</style>
          
          <div className="wd-web-grid" style={{ display: "flex", flexDirection: "column", gap: "36px" }}>
            
            {/* LEFT COLUMN: Featured highlights */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <SectionHeader label={`Featured Highlights — Ranks 1–${allFeatured.length}`} theme={theme} />
              {allFeatured.map((card, idx) => (
                <article key={card.repo.repo_id}>
                  <FeaturedRepositoryCard
                    card={card}
                    layout={idx === 0 ? "large" : "medium"}
                    maxVelocity={maxVelocity}
                    theme={theme}
                  />
                </article>
              ))}
            </div>

            {/* RIGHT COLUMN: Sidebar Widgets */}
            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              {/* Sidebar Block 1: This Week in Numbers */}
              <div style={{
                background: theme.colors.bgSurface,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.lg,
                padding: theme.spacing.xl
              }}>
                <h4 style={{
                  fontSize: "12px",
                  fontWeight: theme.typography.fontWeightBold,
                  color: theme.colors.textPrimary,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: "0 0 16px 0",
                  fontFamily: theme.typography.fontFamilySans
                }}>This Week in Numbers</h4>
                {coverProps.heroMetrics?.map((m: any, idx: number) => (
                  <SidebarMetric key={idx} label={m.label} value={m.value} color={m.color} theme={theme} />
                ))}
              </div>

              {/* Sidebar Block 2: Language Distribution */}
              {chartsProps.languages && (
                <ChartCard title="Language Distribution" theme={theme}>
                  {chartsProps.languages.map((ld: any, idx: number) => (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontFamily: theme.typography.fontFamilySans }}>
                        <span style={{ color: theme.colors.textSecondary }}>{ld.name}</span>
                        <span style={{ fontWeight: theme.typography.fontWeightBold }}>{ld.value} repos ({ld.percentage.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: theme.radius.sm, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${ld.percentage}%`,
                          background: theme.charts.colors[idx % theme.charts.colors.length],
                          borderRadius: theme.radius.sm
                        }} />
                      </div>
                    </div>
                  ))}
                </ChartCard>
              )}

              {/* Sidebar Block 3: Acceleration Leaders */}
              {chartsProps.acceleratorLeaders && (
                <ChartCard title="Top Growth Accelerators" theme={theme}>
                  {chartsProps.acceleratorLeaders.map((acc: any, idx: number) => (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontFamily: theme.typography.fontFamilySans }}>
                        <span style={{ color: theme.colors.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                          {acc.name}
                        </span>
                        <span style={{ fontWeight: theme.typography.fontWeightBold, color: theme.colors.accentCyan }}>{acc.value.toFixed(1)}x</span>
                      </div>
                      <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: theme.radius.sm, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${acc.normalizedPercent}%`,
                          background: theme.colors.gradientBlue,
                          borderRadius: theme.radius.sm
                        }} />
                      </div>
                    </div>
                  ))}
                </ChartCard>
              )}

              {/* Sidebar Block 4: Watch List */}
              {trendingProps.watchList && trendingProps.watchList.length > 0 && (
                <div style={{
                  background: theme.colors.bgSurface,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.xl
                }}>
                  <h4 style={{
                    fontSize: "12px",
                    fontWeight: theme.typography.fontWeightBold,
                    color: theme.colors.textPrimary,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    margin: "0 0 16px 0",
                    fontFamily: theme.typography.fontFamilySans
                  }}>Ecosystem Watch List</h4>
                  {trendingProps.watchList.map((wl: any, idx: number) => (
                    <div key={idx} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: `${theme.spacing.sm} 0`,
                      borderBottom: `1px solid ${theme.colors.border}`,
                      fontFamily: theme.typography.fontFamilySans
                    }}>
                      <span style={{ fontSize: "12px", color: theme.colors.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
                        {wl.name}
                      </span>
                      <span style={{
                        fontSize: "11px",
                        fontWeight: theme.typography.fontWeightBold,
                        color: theme.colors.healthRed,
                        background: "rgba(248,81,73,0.1)",
                        padding: "2px 6px",
                        borderRadius: theme.radius.sm
                      }}>{wl.health} Risk</span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Methodology Block */}
        <div style={{
          marginTop: "48px",
          background: theme.colors.bgSurface,
          border: `1px dashed ${theme.colors.border}`,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.xl,
          fontSize: "12px",
          color: theme.colors.textSecondary,
          lineHeight: "1.6",
          fontFamily: theme.typography.fontFamilySans
        }}>
          <strong>Methodology —</strong> {aboutProps.methodology}
        </div>

        {/* Footer */}
        <Footer weekId={coverProps.weekId} theme={theme} />
      </div>
    );
  }
}
