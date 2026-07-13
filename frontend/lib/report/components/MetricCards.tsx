import React from "react";
import { ReportTheme, defaultTheme } from "../theme";

interface MetricCellProps {
  label: string;
  value: string;
  color?: string;
  theme?: ReportTheme;
}

export const MetricCell: React.FC<MetricCellProps> = ({ label, value, color, theme = defaultTheme }) => {
  return (
    <div style={{
      flex: 1,
      minWidth: "120px",
      background: theme.colors.bgSurface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing.xs
    }}>
      <div style={{
        fontSize: theme.typography.fontSizeTitleMedium,
        fontWeight: theme.typography.fontWeightBold,
        color: color || theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamilySans
      }}>{value}</div>
      <div style={{
        fontSize: theme.typography.fontSizeDetail,
        color: theme.colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        fontFamily: theme.typography.fontFamilySans
      }}>{label}</div>
    </div>
  );
};

interface MetricCardsProps {
  metrics: Array<{ label: string; value: string; color?: string }>;
  theme?: ReportTheme;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ metrics, theme = defaultTheme }) => {
  return (
    <div style={{
      display: "flex",
      gap: theme.spacing.lg,
      flexWrap: "wrap",
      width: "100%",
      boxSizing: "border-box"
    }}>
      {metrics.map((m, idx) => (
        <MetricCell key={idx} label={m.label} value={m.value} color={m.color} theme={theme} />
      ))}
    </div>
  );
};
