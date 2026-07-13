import React from "react";
import { ReportTheme, defaultTheme } from "../theme";

interface ReportHeaderProps {
  weekId: string;
  theme?: ReportTheme;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({ weekId, theme = defaultTheme }) => {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing.lg }}>
      <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.md }}>
        <div style={{
          width: "48px",
          height: "48px",
          borderRadius: theme.radius.lg,
          background: theme.colors.gradientAccent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.colors.bgPrimary,
          fontWeight: theme.typography.fontWeightExtraBold,
          fontSize: "20px"
        }}>R</div>
        <div>
          <div style={{ fontSize: "18px", fontWeight: theme.typography.fontWeightExtraBold, letterSpacing: "0.05em", color: theme.colors.textPrimary, fontFamily: theme.typography.fontFamilySans }}>REPODAR</div>
          <div style={{ fontSize: "11px", fontFamily: theme.typography.fontFamilyMono, color: theme.colors.textSecondary, letterSpacing: "0.1em" }}>INTELLIGENCE SYSTEM</div>
        </div>
      </div>
      <div style={{
        border: `1px solid ${theme.colors.borderActive}`,
        background: "rgba(0,240,255,0.05)",
        color: theme.colors.accentCyan,
        padding: "6px 14px",
        borderRadius: theme.radius.sm,
        fontSize: theme.typography.fontSizeDetail,
        fontFamily: theme.typography.fontFamilyMono,
        fontWeight: theme.typography.fontWeightBold
      }}>WEEK {weekId}</div>
    </div>
  );
};
