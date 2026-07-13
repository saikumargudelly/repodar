import React from "react";
import { ReportTheme, defaultTheme } from "../theme";

interface FooterProps {
  weekId: string;
  theme?: ReportTheme;
}

export const Footer: React.FC<FooterProps> = ({ weekId, theme = defaultTheme }) => {
  return (
    <div style={{
      borderTop: `3px double ${theme.colors.border}`,
      paddingTop: theme.spacing.lg,
      marginTop: theme.spacing.xxl,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: "10px",
      color: theme.colors.textMuted,
      fontFamily: theme.typography.fontFamilySans,
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      width: "100%",
      boxSizing: "border-box"
    }}>
      <span>© {new Date().getFullYear()} Repodar Intelligence System — automated analysis, not human editorial</span>
      <span>repodar.io · Edition #{weekId}</span>
    </div>
  );
};
