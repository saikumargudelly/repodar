export const typography = {
  fontFamilySans: "Inter, -apple-system, sans-serif",
  fontFamilySerif: "'Playfair Display', Georgia, serif",
  fontFamilyMono: "monospace",
  
  fontSizeTitleLarge: "42px",
  fontSizeTitleMedium: "26px",
  fontSizeHeadline: "19px",
  fontSizeBody: "13px",
  fontSizeDetail: "11px",
  fontSizeLabel: "10px",
  
  fontWeightLight: 300,
  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightSemiBold: 600,
  fontWeightBold: 700,
  fontWeightExtraBold: 800,
  fontWeightBlack: 900
} as const;

export type Typography = typeof typography;
