import { ReportTheme } from "../theme";

export interface ReportBranding {
  name: string;
  logoUrl: string;
  websiteUrl: string;
  githubUrl: string;
  slogan: string;
}

export interface RenderContext {
  width: number;
  height: number;
  dpi: number;
  theme: ReportTheme;
  branding: ReportBranding;
  quality: number;
  outputFormat: "png" | "svg";
  rendererOptions?: Record<string, any>;
}

export interface PageMetadata {
  weekId: string;
  index: number;
  totalPageCount?: number;
  [key: string]: any;
}

export interface Page {
  id: string;
  type: "cover" | "featured-repo-large" | "featured-repos-medium" | "featured-repos-compact" | "charts" | "trending-watchlist" | "about";
  title: string;
  dimensions: { width: number; height: number };
  metadata: PageMetadata;
  components: Array<{
    type: string;
    props: Record<string, any>;
  }>;
}

export interface ReportRenderer<TOutput> {
  render(pages: Page[], context: RenderContext): Promise<TOutput>;
}
