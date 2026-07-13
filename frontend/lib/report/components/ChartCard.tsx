import React from "react";
import { ReportTheme, defaultTheme } from "../theme";

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  theme?: ReportTheme;
}

export const ChartCard: React.FC<ChartCardProps> = ({ title, children, theme = defaultTheme }) => {
  return (
    <div style={{
      background: theme.colors.bgSurface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.xl,
      boxSizing: "border-box",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing.lg
    }}>
      <h4 style={{
        fontSize: "14px",
        fontWeight: theme.typography.fontWeightBold,
        color: theme.colors.textPrimary,
        margin: 0,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        fontFamily: theme.typography.fontFamilySans,
        borderBottom: `1px solid ${theme.colors.border}`,
        paddingBottom: theme.spacing.sm
      }}>{title}</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
        {children}
      </div>
    </div>
  );
};
