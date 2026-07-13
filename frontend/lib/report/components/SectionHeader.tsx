import React from "react";
import { ReportTheme, defaultTheme } from "../theme";

interface SectionHeaderProps {
  label: string;
  theme?: ReportTheme;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ label, theme = defaultTheme }) => {
  return (
    <div style={{ margin: `${theme.spacing.xl} 0 ${theme.spacing.md} 0` }}>
      <p style={{
        fontSize: theme.typography.fontSizeLabel,
        fontWeight: theme.typography.fontWeightBold,
        color: theme.colors.accentCyan,
        textTransform: "uppercase",
        letterSpacing: "0.15em",
        margin: 0,
        fontFamily: theme.typography.fontFamilySans
      }}>{label}</p>
    </div>
  );
};
