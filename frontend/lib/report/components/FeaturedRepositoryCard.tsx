import React from "react";
import { PresentationRepositoryCard } from "../presentation/presentationModel";
import { ReportTheme, defaultTheme } from "../theme";

interface FeaturedRepositoryCardProps {
  card: PresentationRepositoryCard;
  layout?: "large" | "medium";
  maxVelocity?: number;
  theme?: ReportTheme;
}

export const FeaturedRepositoryCard: React.FC<FeaturedRepositoryCardProps> = ({
  card,
  layout = "medium",
  maxVelocity = 1000,
  theme = defaultTheme
}) => {
  const repo = card.repo;
  const healthColor = card.healthColor;
  const pct = maxVelocity > 0 ? Math.min(100, Math.round(((repo.star_velocity_7d || 0) / maxVelocity) * 100)) : 0;

  return (
    <div style={{
      background: theme.colors.bgSurface,
      border: `1px solid ${theme.colors.border}`,
      borderLeft: `5px solid ${healthColor}`,
      borderRadius: `0 ${theme.radius.lg} ${theme.radius.lg} 0`,
      padding: layout === "large" ? theme.spacing.xxl : theme.spacing.xl,
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing.md,
      boxSizing: "border-box",
      width: "100%"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: theme.spacing.sm }}>
        <div>
          <div style={{
            fontSize: "11px",
            fontWeight: theme.typography.fontWeightSemiBold,
            color: theme.colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontFamily: theme.typography.fontFamilyMono
          }}>
            #{String(card.rank).padStart(2, "0")} · Featured Breakout
          </div>
          <h3 style={{
            fontSize: layout === "large" ? "24px" : "19px",
            fontWeight: theme.typography.fontWeightBold,
            color: theme.colors.textPrimary,
            margin: `${theme.spacing.xs} 0 0 0`,
            fontFamily: theme.typography.fontFamilySans
          }}>
            {repo.owner}/<span style={{ color: theme.colors.accentCyan }}>{repo.name}</span>
          </h3>
        </div>
        <div style={{
          fontSize: "11px",
          color: theme.colors.textSecondary,
          fontFamily: theme.typography.fontFamilyMono,
          border: `1px solid ${theme.colors.border}`,
          padding: "2px 8px",
          borderRadius: theme.radius.sm
        }}>GitHub ↗</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: theme.spacing.sm, alignItems: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamilySans }}>
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: healthColor }} />
          {card.healthLabel} Health
        </span>
        {repo.category && (
          <span style={{
            fontSize: "10px",
            background: "rgba(255,255,255,0.06)",
            color: theme.colors.textSecondary,
            padding: "2px 6px",
            borderRadius: theme.radius.sm,
            fontFamily: theme.typography.fontFamilySans
          }}>{repo.category}</span>
        )}
        {repo.primary_language && (
          <span style={{
            fontSize: "10px",
            background: "rgba(255,255,255,0.06)",
            color: theme.colors.textSecondary,
            padding: "2px 6px",
            borderRadius: theme.radius.sm,
            fontFamily: theme.typography.fontFamilySans
          }}>{repo.primary_language}</span>
        )}
      </div>

      {repo.description && (
        <p style={{
          fontSize: theme.typography.fontSizeBody,
          color: theme.colors.textSecondary,
          margin: 0,
          lineHeight: "1.5",
          fontFamily: theme.typography.fontFamilySans
        }}>{repo.description}</p>
      )}

      <div style={{ display: "flex", gap: theme.spacing.xl, fontSize: theme.typography.fontSizeBody, color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamilySans }}>
        <span>★ <span style={{ fontWeight: theme.typography.fontWeightBold, color: theme.colors.textPrimary }}>{repo.stars?.toLocaleString() || "—"}</span> total</span>
        <span>⚡ <span style={{ fontWeight: theme.typography.fontWeightBold, color: theme.colors.accentGold }}>+{repo.star_velocity_7d?.toFixed(0)}/day</span></span>
        <span>📈 <span style={{ fontWeight: theme.typography.fontWeightBold, color: theme.colors.textPrimary }}>{repo.acceleration?.toFixed(1)}x</span> accel</span>
      </div>

      {/* Velocity Bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: theme.radius.sm, overflow: "hidden", width: "100%" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(to right, #d29922, #f0a500)", borderRadius: theme.radius.sm }} />
        </div>
      </div>

      {/* Analyst commentary */}
      <div style={{
        borderLeft: `3px solid ${theme.colors.borderActive}`,
        background: "rgba(255,255,255,0.01)",
        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
        fontSize: "12px",
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamilySans,
        lineHeight: "1.4"
      }}>
        <strong>Analyst note —</strong> {card.analystComment}
      </div>
    </div>
  );
};
