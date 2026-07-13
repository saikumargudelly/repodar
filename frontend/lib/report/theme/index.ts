import { colors } from "./colors";
import { typography } from "./typography";
import { spacing } from "./spacing";
import { radius } from "./radius";
import { shadows } from "./shadows";
import { charts } from "./charts";

export interface ReportTheme {
  colors: typeof colors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
  charts: typeof charts;
}

export const defaultTheme: ReportTheme = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  charts
};

export { colors, typography, spacing, radius, shadows, charts };
