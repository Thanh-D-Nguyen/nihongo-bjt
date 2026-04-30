import sharp from "sharp";

export type ShareRenderKind = "streak" | "bjt_result" | "daily_phrase" | "battle";

export interface ShareImageRenderInput {
  /** Safe template label (no user PII). */
  config: Record<string, unknown>;
  headline: string;
  kind: ShareRenderKind;
  sub: string;
}

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Renders a PNG postcard from SVG; templates stay server-side, not ad-hoc screenshots.
 */
export class ShareImageRenderer {
  async renderPng(input: ShareImageRenderInput) {
    const w = 1200;
    const h = 630;
    const bg = (input.config.brandBg as string) || "#0f172a";
    const fg = (input.config.brandFg as string) || "#e2e8f0";
    const accent = (input.config.brandAccent as string) || "#38bdf8";
    const badge = (input.config.badgeKey as string) || "NihonGo BJT";
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${escapeXml(bg)}"/>
  <text x="64" y="100" font-size="32" font-family="ui-sans-serif, system-ui" fill="${escapeXml(accent)}">${escapeXml(badge)}</text>
  <text x="64" y="280" font-size="64" font-family="ui-sans-serif, system-ui" font-weight="700" fill="${escapeXml(fg)}">${escapeXml(
    input.headline
  )}</text>
  <text x="64" y="380" font-size="40" font-family="ui-sans-serif, system-ui" fill="${escapeXml(
    fg
  )}" opacity="0.9">${escapeXml(input.sub)}</text>
  <text x="64" y="580" font-size="28" font-family="ui-sans-serif, system-ui" fill="${escapeXml(
    fg
  )}" opacity="0.5">${escapeXml(input.kind)}</text>
</svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}
