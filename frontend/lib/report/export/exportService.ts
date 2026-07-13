import { Page, RenderContext } from "../types";

export interface ExportProgress {
  total: number;
  current: number;
  stage: "rendering" | "encoding" | "downloading" | "complete" | "error";
  message: string;
}

export type ProgressCallback = (progress: ExportProgress) => void;

export class ExportService {
  /**
   * Orchestrates exporting portrait carousel pages to PNGs and generating manifest.json.
   * Finds the DOM nodes rendered under the container ID and converts them page-by-page.
   */
  static async exportCarousel(
    pages: Page[],
    context: RenderContext,
    containerId: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    try {
      const totalPages = pages.length;
      if (onProgress) {
        onProgress({
          total: totalPages,
          current: 0,
          stage: "rendering",
          message: "Preparing slides for render..."
        });
      }

      // 1. Lazy-load html-to-image
      const { toPng } = await import("html-to-image");

      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Export container with ID "${containerId}" not found in DOM.`);
      }

      const fileUrls: string[] = [];

      // 2. Iterate and render each slide node
      for (let i = 0; i < totalPages; i++) {
        const pageIdx = i + 1;
        if (onProgress) {
          onProgress({
            total: totalPages,
            current: pageIdx,
            stage: "encoding",
            message: `Encoding slide ${pageIdx} of ${totalPages} to high-res PNG...`
          });
        }

        const node = container.querySelector(`[data-page-index="${pageIdx}"]`) as HTMLElement;
        if (!node) {
          throw new Error(`Slide DOM node for page index ${pageIdx} not found under container.`);
        }

        // Generate data URL
        const dataUrl = await toPng(node, {
          pixelRatio: context.dpi,
          quality: context.quality,
          cacheBust: true
        });
        fileUrls.push(dataUrl);

        // Optional tiny pause to prevent thread-blocking
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // 3. Download the PNG files sequentially
      if (onProgress) {
        onProgress({
          total: totalPages,
          current: totalPages,
          stage: "downloading",
          message: "Orchestrating file downloads..."
        });
      }

      const weekId = context.branding.name.toLowerCase() + "-" + pages[0]?.metadata.weekId;
      for (let i = 0; i < fileUrls.length; i++) {
        const pageIdx = i + 1;
        const link = document.createElement("a");
        link.download = `${weekId}-page-${pageIdx}.png`;
        link.href = fileUrls[i];
        link.click();
        
        // Stagger browser downloads to prevent throttling
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // 4. Generate and download manifest.json
      const manifest = {
        week: pages[0]?.metadata.weekId || "unknown",
        generatedAt: new Date().toISOString(),
        pageCount: totalPages,
        width: context.width,
        height: context.height,
        theme: {
          colors: context.theme.colors,
          typography: {
            fontFamilySans: context.theme.typography.fontFamilySans,
            fontFamilySerif: context.theme.typography.fontFamilySerif
          }
        },
        branding: {
          name: context.branding.name,
          website: context.branding.websiteUrl
        },
        version: "1.0.0",
        pages: pages.map((p, idx) => ({
          index: idx + 1,
          title: p.title,
          file: `${weekId}-page-${idx + 1}.png`
        }))
      };

      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
      const manifestUrl = URL.createObjectURL(manifestBlob);
      const manifestLink = document.createElement("a");
      manifestLink.download = `${weekId}-manifest.json`;
      manifestLink.href = manifestUrl;
      manifestLink.click();
      URL.revokeObjectURL(manifestUrl);

      if (onProgress) {
        onProgress({
          total: totalPages,
          current: totalPages,
          stage: "complete",
          message: "All pages and manifest successfully generated!"
        });
      }
    } catch (err: any) {
      console.error("Export Service failed:", err);
      if (onProgress) {
        onProgress({
          total: pages.length,
          current: 0,
          stage: "error",
          message: `Export failed: ${err.message || String(err)}`
        });
      }
      throw err;
    }
  }
}
