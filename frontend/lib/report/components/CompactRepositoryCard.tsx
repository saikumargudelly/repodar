import React from "react";
import { PresentationRepositoryCard } from "../presentation/presentationModel";
import { ReportTheme, defaultTheme } from "../theme";

interface CompactRepositoryCardProps {
  card: PresentationRepositoryCard;
  theme?: ReportTheme;
}

export const CompactRepositoryCard: React.FC<CompactRepositoryCardProps> = ({ card, theme = defaultTheme }) => {
  const repo = card.repo;
  const healthColor = card.healthColor;

  return (
    <div style={{
      background: theme.colors.bgSurface,
      border: `1px solid ${theme.colors.border}`,
      borderLeft: `5px solid ${healthColor}`,
      borderRadius: `0 ${theme.radius.lg} ${theme.radius.lg} 0`,
      padding: theme.spacing.lg,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      boxSizing: "border-box",
      width: "100%",
      fontFamily: theme.typography.fontFamilySans
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.lg, flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: theme.typography.fontSizeTitleMedium,
          fontWeight: theme.typography.fontWeightBold,
          color: theme.colors.accentCyan,
          opacity: 0.6,
          width: "40px",
          fontFamily: theme.typography.fontFamilyMono
        }}>
          #{String(card.rank).padStart(2, "0")}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "16px", fontWeight: theme.typography.fontWeightBold, color: theme.colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {repo.owner}/<span style={{ color: theme.colors.accentCyan }}>{repo.name}</span>
          </div>
          <div style={{ fontSize: "12px", color: theme.colors.textSecondary, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {repo.description || "No description available."}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px", textAlign: "right", flexShrink: 0, marginLeft: theme.spacing.md }}>
        <div>
          <div style={{ fontSize: "9px", color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamilyMono, letterSpacing: "0.05em" }}>7D VELOCITY</div>
          <div style={{ fontSize: "14px", fontWeight: theme.typography.fontWeightBold, color: theme.colors.accentGold, marginTop: "2px" }}>
            +{repo.star_velocity_7d?.toFixed(0)}<span style={{ fontSize: "10px", fontWeight: theme.typography.fontWeightNormal, color: theme.colors.textSecondary }}>/day</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: "9px", color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamilyMono, letterSpacing: "0.05em" }}>HEALTH</div>
          <div style={{ fontSize: "14px", fontWeight: theme.typography.fontWeightBold, color: healthColor, marginTop: "2px" }}>
            {card.healthLabel}
          </div>
        </div>
      </div>
    </div>
  );
};
