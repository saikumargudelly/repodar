import React from "react";
import { Page, RenderContext, ReportRenderer } from "../types";
import { ReportHeader } from "../components/ReportHeader";
import { MetricCards } from "../components/MetricCards";
import { FeaturedRepositoryCard } from "../components/FeaturedRepositoryCard";
import { CompactRepositoryCard } from "../components/CompactRepositoryCard";
import { ChartCard } from "../components/ChartCard";
import { SidebarMetric } from "../components/SidebarMetric";
import { SectionHeader } from "../components/SectionHeader";
import { Footer } from "../components/Footer";

export class PortraitCarouselRenderer implements ReportRenderer<React.ReactNode[]> {
  async render(pages: Page[], context: RenderContext): Promise<React.ReactNode[]> {
    const theme = context.theme;

    // We locate the max velocity among all featured cards to align the VeloBars
    let maxVelocity = 1000;
    const featuredPages = pages.filter(p => p.type === "featured-repo-large" || p.type === "featured-repos-medium");
    const allCards = featuredPages.flatMap(p => {
      if (p.type === "featured-repo-large") return [p.components[0].props.card];
      return p.components[0].props.cards || [];
    });
    if (allCards.length > 0) {
      maxVelocity = Math.max(...allCards.map(c => c.repo.star_velocity_7d || 0));
    }

    return pages.map((page, index) => {
      const pageNum = index + 1;
      const totalPages = pages.length;

      // Helper to render slide indicator and branding at the bottom
      const renderSlideFooter = () => (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `1px solid ${theme.colors.border}`,
          paddingTop: theme.spacing.md,
          marginTop: theme.spacing.lg,
          fontSize: "11px",
          fontFamily: theme.typography.fontFamilyMono,
          color: theme.colors.textSecondary
        }}>
          <span>{context.branding.websiteUrl} · {context.branding.name}</span>
          <span style={{
            background: "rgba(255,255,255,0.06)",
            padding: "2px 8px",
            borderRadius: theme.radius.sm,
            fontWeight: theme.typography.fontWeightBold,
            color: theme.colors.accentCyan
          }}>{pageNum} / {totalPages}</span>
        </div>
      );

      return (
        <div
          key={page.id}
          data-page-index={pageNum}
          style={{
            width: `${context.width}px`,
            height: `${context.height}px`,
            background: theme.colors.gradientBackground,
            color: theme.colors.textPrimary,
            padding: theme.spacing.layoutPadding,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            fontFamily: theme.typography.fontFamilySans,
            boxSizing: "border-box",
            border: `1px solid ${theme.colors.border}`,
            position: "relative",
            overflow: "hidden"
          }}
        >
          {/* Main Slide Content */}
          <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", paddingBottom: "24px" }}>
            <div>
              <ReportHeader weekId={page.metadata.weekId} theme={theme} />
              
              {/* Cover Slide */}
              {page.type === "cover" && (
                <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "32px" }}>
                  <div>
                    <h1 style={{
                      fontSize: "44px",
                      fontWeight: theme.typography.fontWeightBlack,
                      lineHeight: "1.1",
                      margin: "0 0 16px 0",
                      color: theme.colors.textPrimary,
                      fontFamily: theme.typography.fontFamilySans,
                      letterSpacing: "-0.02em"
                    }}>{page.components[0].props.title}</h1>
                    <p style={{
                      fontSize: "16px",
                      color: theme.colors.textSecondary,
                      lineHeight: "1.5",
                      margin: 0,
                      maxWidth: "800px"
                    }}>{page.components[0].props.subtitle}</p>
                  </div>

                  <div style={{ width: "100%" }}>
                    <MetricCards metrics={page.components[0].props.heroMetrics} theme={theme} />
                  </div>

                  {page.components[0].props.topHighlights && (
                    <div style={{
                      background: "rgba(255,255,255,0.01)",
                      border: `1px dashed ${theme.colors.border}`,
                      borderRadius: theme.radius.lg,
                      padding: theme.spacing.lg
                    }}>
                      <div style={{ fontSize: "11px", fontWeight: theme.typography.fontWeightBold, color: theme.colors.accentCyan, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                        Top Breakout Highlights
                      </div>
                      <div style={{ display: "flex", gap: "24px", fontSize: "14px", fontWeight: theme.typography.fontWeightBold }}>
                        {page.components[0].props.topHighlights.map((hl: string, idx: number) => (
                          <span key={idx} style={{ color: theme.colors.textPrimary }}>
                            #{idx + 1} <span style={{ color: theme.colors.accentCyan }}>{hl}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Large Featured Card Slide */}
              {page.type === "featured-repo-large" && (
                <div style={{ marginTop: "24px" }}>
                  <FeaturedRepositoryCard
                    card={page.components[0].props.card}
                    layout="large"
                    maxVelocity={maxVelocity}
                    theme={theme}
                  />
                </div>
              )}

              {/* Medium Featured Card Slide */}
              {page.type === "featured-repos-medium" && (
                <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <SectionHeader label={page.title} theme={theme} />
                  {page.components[0].props.cards.map((card: any) => (
                    <FeaturedRepositoryCard
                      key={card.repo.repo_id}
                      card={card}
                      layout="medium"
                      maxVelocity={maxVelocity}
                      theme={theme}
                    />
                  ))}
                </div>
              )}

              {/* Compact Featured Card Slide */}
              {page.type === "featured-repos-compact" && (
                <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <SectionHeader label={page.title} theme={theme} />
                  {page.components[0].props.cards.map((card: any) => (
                    <CompactRepositoryCard
                      key={card.repo.repo_id}
                      card={card}
                      theme={theme}
                    />
                  ))}
                </div>
              )}

              {/* Charts Slide */}
              {page.type === "charts" && (
                <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <SectionHeader label={page.title} theme={theme} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    
                    {/* Left Chart: Language distribution */}
                    <ChartCard title="Primary Language breakdown" theme={theme}>
                      {page.components[0].props.charts.languages.slice(0, 5).map((ld: any, idx: number) => (
                        <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                            <span style={{ color: theme.colors.textSecondary }}>{ld.name}</span>
                            <span style={{ fontWeight: theme.typography.fontWeightBold }}>{ld.percentage.toFixed(0)}%</span>
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

                    {/* Right Chart: Acceleration leaders */}
                    <ChartCard title="Velocity Acceleration leaders" theme={theme}>
                      {page.components[0].props.charts.acceleratorLeaders.map((acc: any, idx: number) => (
                        <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                            <span style={{ color: theme.colors.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>
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
                  </div>

                  {/* Horizontal Health Breakdown widget */}
                  <div style={{
                    background: theme.colors.bgSurface,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.lg,
                    padding: theme.spacing.xl,
                    display: "flex",
                    flexDirection: "column",
                    gap: theme.spacing.sm
                  }}>
                    <div style={{ fontSize: "12px", fontWeight: theme.typography.fontWeightBold, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.colors.textPrimary }}>
                      Ecosystem Cohort Health
                    </div>
                    <div style={{ display: "flex", height: "8px", borderRadius: theme.radius.full, overflow: "hidden", gap: "2px", margin: "8px 0" }}>
                      <div style={{ flex: 7, background: theme.colors.healthGreen }} />
                      <div style={{ flex: 2, background: theme.colors.healthYellow }} />
                      <div style={{ flex: 1, background: theme.colors.healthRed }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: theme.colors.textSecondary }}>
                      <span>🟢 Jonin (Production-Ready)</span>
                      <span>🟡 Chunin (Monitor)</span>
                      <span>🔴 Genin (High Risk Alert)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Trending & Watchlist Slide */}
              {page.type === "trending-watchlist" && (
                <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <SectionHeader label={page.title} theme={theme} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    
                    {/* Left: Trending lists */}
                    <div style={{
                      background: theme.colors.bgSurface,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radius.lg,
                      padding: theme.spacing.xl
                    }}>
                      <div style={{ fontSize: "12px", fontWeight: theme.typography.fontWeightBold, color: theme.colors.textPrimary, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                        Trending Cohort (Ranks 11-25)
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {page.components[0].props.trendingList.slice(0, 7).map((item: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", borderBottom: `1px solid ${theme.colors.border}`, paddingBottom: "4px" }}>
                            <span style={{ color: theme.colors.textSecondary }}>#{item.rank} {item.name}</span>
                            <span style={{ color: theme.colors.accentGold, fontWeight: theme.typography.fontWeightBold }}>+{item.velocity.toFixed(0)}/d</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Watch list */}
                    <div style={{
                      background: theme.colors.bgSurface,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radius.lg,
                      padding: theme.spacing.xl
                    }}>
                      <div style={{ fontSize: "12px", fontWeight: theme.typography.fontWeightBold, color: theme.colors.textPrimary, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                        Ecosystem Alert Watch List
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {page.components[0].props.watchList.slice(0, 7).map((item: any, idx: number) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", borderBottom: `1px solid ${theme.colors.border}`, paddingBottom: "4px" }}>
                            <span style={{ color: theme.colors.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>
                              {item.name}
                            </span>
                            <span style={{ color: theme.colors.healthRed, fontWeight: theme.typography.fontWeightBold }}>{item.health} Risk</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Editorial Lead */}
                  <div style={{
                    background: "rgba(255,255,255,0.01)",
                    borderLeft: `4px solid ${theme.colors.accentCyan}`,
                    padding: theme.spacing.lg,
                    fontSize: "12px",
                    color: theme.colors.textSecondary,
                    lineHeight: "1.5"
                  }}>
                    <strong>Ecosystem Analysis: </strong> {page.components[0].props.editorial.leadBody}
                  </div>
                </div>
              )}

              {/* About & Methodology Slide */}
              {page.type === "about" && (
                <div style={{ marginTop: "48px", display: "flex", flexDirection: "column", gap: "40px" }}>
                  <div>
                    <h2 style={{
                      fontSize: "28px",
                      fontWeight: theme.typography.fontWeightBold,
                      color: theme.colors.textPrimary,
                      marginBottom: "12px",
                      fontFamily: theme.typography.fontFamilySans
                    }}>Ecosystem Methodology</h2>
                    <p style={{
                      fontSize: "15px",
                      color: theme.colors.textSecondary,
                      lineHeight: "1.6",
                      margin: 0
                    }}>{page.components[0].props.about.methodology}</p>
                  </div>

                  <div style={{
                    background: theme.colors.bgSurface,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.lg,
                    padding: theme.spacing.xl,
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px"
                  }}>
                    <div style={{ fontSize: "14px", fontWeight: theme.typography.fontWeightBold, color: theme.colors.accentCyan }}>
                      Access Real-Time Intelligence
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ fontSize: "11px", color: theme.colors.textSecondary }}>PLATFORM WEBSITE</span>
                        <span style={{ fontSize: "16px", fontWeight: theme.typography.fontWeightBold, color: theme.colors.textPrimary }}>
                          {page.components[0].props.about.links.website}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: theme.colors.textSecondary }}>OPEN SOURCE REPOSITORY</span>
                        <span style={{ fontSize: "16px", fontWeight: theme.typography.fontWeightBold, color: theme.colors.textPrimary }}>
                          {page.components[0].props.about.links.links?.github || "github.com/saikumargudelly/repodar"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    textAlign: "center",
                    padding: "12px",
                    fontStyle: "italic",
                    fontSize: "13px",
                    color: theme.colors.textSecondary
                  }}>
                    "{page.components[0].props.about.slogan}"
                  </div>
                </div>
              )}

            </div>
            {renderSlideFooter()}
          </div>
        </div>
      );
    });
  }
}
