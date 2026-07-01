/**
 * Formats numbers compactly (e.g. 1.2k, 1.5M) consistently across the app.
 */
export function formatCompactNumber(num: number): string {
  if (num === null || num === undefined || isNaN(num)) return "0";
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(num);
}
