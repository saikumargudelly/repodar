import React from "react";
import { ReportTheme, defaultTheme } from "../theme";

interface SidebarMetricProps {
  label: string;
  value: string;
  color?: string;
  theme?: ReportTheme;
}

export const SidebarMetric: React.FC<SidebarMetricProps> = ({ label, value, color, theme = defaultTheme }) => {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: `${theme.spacing.sm} 0`,
      borderBottom: `1px solid ${theme.colors.border}`,
      fontFamily: theme.typography.fontFamilySans
    }}>
      <span style={{ fontSize: "12px", color: theme.colors.textSecondary }}>{label}</span>
      <span style={{
        fontSize: "15px",
        fontWeight: theme.typography.fontWeightBold,
        color: color || theme.colors.textPrimary
      }}>{value}</span>
    </div>
  );
};
