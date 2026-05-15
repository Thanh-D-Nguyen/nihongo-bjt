import sharp from "sharp";

export type ShareRenderKind =
  | "streak"
  | "bjt_result"
  | "daily_phrase"
  | "battle";

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

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const JP_FONT =
  "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif";

function cfg(input: ShareImageRenderInput) {
  const c = input.config;
  return {
    bg: (c.brandBg as string) || "",
    bgEnd: (c.brandBgEnd as string) || "",
    fg: (c.brandFg as string) || "#e2e8f0",
    accent: (c.brandAccent as string) || "#38bdf8",
    badge: (c.badgeKey as string) || "NihonGo BJT",
    pattern: (c.pattern as string) || "",
  };
}

function gradientOrSolid(
  id: string,
  bg: string,
  bgEnd: string,
  direction: "vertical" | "diagonal" = "vertical",
): string {
  if (!bgEnd) {
    return `<rect width="100%" height="100%" fill="${escapeXml(bg)}"/>`;
  }
  const coords =
    direction === "diagonal"
      ? 'x1="0%" y1="0%" x2="100%" y2="100%"'
      : 'x1="0%" y1="0%" x2="0%" y2="100%"';
  return `<defs><linearGradient id="${id}" ${coords}>
    <stop offset="0%" stop-color="${escapeXml(bg)}"/>
    <stop offset="100%" stop-color="${escapeXml(bgEnd)}"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>`;
}

function foreignText(
  x: number,
  y: number,
  w: number,
  h: number,
  html: string,
  style: string,
): string {
  return `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="${style}">${html}</div>
  </foreignObject>`;
}

/* ── Pattern generators ─────────────────────────────────────── */

function patternDots(w: number, h: number, opacity = 0.08): string {
  const cols = Math.ceil(w / 40);
  const rows = Math.ceil(h / 40);
  let circles = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      circles += `<circle cx="${c * 40 + 20}" cy="${r * 40 + 20}" r="3" fill="white"/>`;
    }
  }
  return `<g opacity="${opacity}">${circles}</g>`;
}

function patternGrid(w: number, h: number, opacity = 0.05): string {
  let lines = "";
  for (let x = 0; x <= w; x += 60) {
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="white" stroke-width="0.5"/>`;
  }
  for (let y = 0; y <= h; y += 60) {
    lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="white" stroke-width="0.5"/>`;
  }
  return `<g opacity="${opacity}">${lines}</g>`;
}

function patternWaves(w: number, h: number, opacity = 0.04): string {
  let paths = "";
  for (let y = 80; y < h; y += 120) {
    paths += `<path d="M0,${y} Q${w * 0.25},${y - 40} ${w * 0.5},${y} T${w},${y}" fill="none" stroke="white" stroke-width="1.5"/>`;
  }
  return `<g opacity="${opacity}">${paths}</g>`;
}

function patternStripes(w: number, h: number, opacity = 0.06): string {
  let rects = "";
  const step = 40;
  for (let i = -h; i < w + h; i += step * 2) {
    rects += `<rect x="${i}" y="0" width="${step}" height="${Math.hypot(w, h) * 2}" fill="white" transform="rotate(-45, ${w / 2}, ${h / 2})"/>`;
  }
  return `<g opacity="${opacity}">${rects}</g>`;
}

function patternFor(
  kind: string,
  override: string,
  w: number,
  h: number,
): string {
  const key =
    override && override !== "none"
      ? override
      : { streak: "dots", bjt_result: "grid", daily_phrase: "waves", battle: "stripes" }[kind] || "none";
  if (key === "none") return "";
  if (key === "dots") return patternDots(w, h);
  if (key === "grid") return patternGrid(w, h);
  if (key === "waves") return patternWaves(w, h);
  if (key === "stripes") return patternStripes(w, h);
  return "";
}

/* ── Flame SVG icon ─────────────────────────────────────────── */

function flameIcon(cx: number, cy: number, size: number, color: string): string {
  const s = size / 48; // base path at 48px
  return `<g transform="translate(${cx - size / 2}, ${cy - size / 2}) scale(${s})">
    <path d="M24 2C24 2 14 14 14 26C14 31.52 18.48 36 24 36C29.52 36 34 31.52 34 26C34 14 24 2 24 2ZM24 32C20.69 32 18 29.31 18 26C18 20 24 10 24 10C24 10 30 20 30 26C30 29.31 27.31 32 24 32Z" fill="${escapeXml(color)}"/>
    <path d="M24 10C24 10 20 18 20 24C20 26.21 21.79 28 24 28C26.21 28 28 26.21 28 24C28 18 24 10 24 10Z" fill="${escapeXml(color)}" opacity="0.6"/>
  </g>`;
}

/* ── Kind-specific renderers ────────────────────────────────── */

/**
 * Renders a PNG postcard from SVG; templates stay server-side, not ad-hoc screenshots.
 */
export class ShareImageRenderer {
  async renderPng(input: ShareImageRenderInput): Promise<Buffer> {
    return this.render(input, 1200, 630);
  }

  async renderPngHiRes(input: ShareImageRenderInput): Promise<Buffer> {
    return this.render(input, 2400, 1260);
  }

  private async render(
    input: ShareImageRenderInput,
    w: number,
    h: number,
  ): Promise<Buffer> {
    let svgBody: string;
    switch (input.kind) {
      case "streak":
        svgBody = this.renderStreak(input, w, h);
        break;
      case "bjt_result":
        svgBody = this.renderBjtResult(input, w, h);
        break;
      case "daily_phrase":
        svgBody = this.renderDailyPhrase(input, w, h);
        break;
      case "battle":
        svgBody = this.renderBattle(input, w, h);
        break;
    }
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svgBody}</svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  /* ── streak: Warm celebration ──────────────────────────────── */

  private renderStreak(input: ShareImageRenderInput, w: number, h: number): string {
    const { bg, bgEnd, fg, accent, badge, pattern } = cfg(input);
    const bgStart = bg || "#1a0a00";
    const bgStop = bgEnd || "#7c2d12";
    const s = w / 1200; // scale factor

    // Extract streak number from headline (digits) for large display
    const streakNum = input.headline.match(/\d+/)?.[0] || "";

    return [
      gradientOrSolid("streakGrad", bgStart, bgStop),
      patternFor("streak", pattern, w, h),

      // Badge
      `<text x="${64 * s}" y="${72 * s}" font-size="${28 * s}" font-family="${JP_FONT}" font-weight="700" fill="${escapeXml(accent)}">${escapeXml(badge)}</text>`,

      // Flame + streak number center
      flameIcon(w / 2 - 100 * s, h * 0.42, 80 * s, accent),
      streakNum
        ? `<text x="${w / 2}" y="${h * 0.46}" font-size="${80 * s}" font-family="${JP_FONT}" font-weight="800" fill="${escapeXml(fg)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(streakNum)}</text>`
        : "",

      // Headline
      foreignText(
        64 * s, h * 0.56, w - 128 * s, 80 * s,
        escapeHtml(input.headline),
        `font-family:${JP_FONT};font-size:${48 * s}px;font-weight:700;color:${escapeHtml(fg)};text-align:center;line-height:1.2;overflow:hidden;`,
      ),

      // Sub
      foreignText(
        64 * s, h * 0.70, w - 128 * s, 60 * s,
        escapeHtml(input.sub),
        `font-family:${JP_FONT};font-size:${32 * s}px;color:${escapeHtml(fg)};opacity:0.8;text-align:center;line-height:1.3;overflow:hidden;`,
      ),

      // Kind label bottom-left
      `<text x="${64 * s}" y="${h - 32 * s}" font-size="${20 * s}" font-family="${JP_FONT}" fill="${escapeXml(fg)}" opacity="0.4" letter-spacing="4">STREAK</text>`,
    ].join("\n");
  }

  /* ── bjt_result: Professional pride ────────────────────────── */

  private renderBjtResult(input: ShareImageRenderInput, w: number, h: number): string {
    const { bg, bgEnd, fg, accent, badge, pattern } = cfg(input);
    const bgStart = bg || "#0f172a";
    const bgStop = bgEnd || "#1e293b";
    const s = w / 1200;

    // Extract band from headline or sub (e.g. J1+, J2)
    const bandMatch = (input.headline + " " + input.sub).match(/J\d\+?/i);
    const band = bandMatch ? bandMatch[0].toUpperCase() : "";
    const circleR = 50 * s;
    const circleCx = 160 * s;
    const circleCy = h * 0.48;

    return [
      gradientOrSolid("bjtGrad", bgStart, bgStop),
      patternFor("bjt_result", pattern, w, h),

      // Badge
      `<text x="${64 * s}" y="${72 * s}" font-size="${28 * s}" font-family="${JP_FONT}" font-weight="700" fill="${escapeXml(accent)}">${escapeXml(badge)}</text>`,

      // Band circle
      `<circle cx="${circleCx}" cy="${circleCy}" r="${circleR}" fill="none" stroke="${escapeXml(accent)}" stroke-width="${3 * s}"/>`,
      band
        ? `<text x="${circleCx}" y="${circleCy}" font-size="${40 * s}" font-family="${JP_FONT}" font-weight="800" fill="${escapeXml(accent)}" text-anchor="middle" dominant-baseline="central">${escapeXml(band)}</text>`
        : "",

      // Headline right of badge
      foreignText(
        circleCx + circleR + 40 * s, h * 0.30, w - circleCx - circleR - 120 * s, 120 * s,
        escapeHtml(input.headline),
        `font-family:${JP_FONT};font-size:${56 * s}px;font-weight:700;color:${escapeHtml(fg)};line-height:1.2;overflow:hidden;`,
      ),

      // Sub below headline
      foreignText(
        circleCx + circleR + 40 * s, h * 0.56, w - circleCx - circleR - 120 * s, 80 * s,
        escapeHtml(input.sub),
        `font-family:${JP_FONT};font-size:${32 * s}px;color:${escapeHtml(fg)};opacity:0.8;line-height:1.3;overflow:hidden;`,
      ),

      // Bottom accent line
      `<line x1="${64 * s}" y1="${h - 60 * s}" x2="${w - 64 * s}" y2="${h - 60 * s}" stroke="${escapeXml(accent)}" stroke-width="${2 * s}" opacity="0.6"/>`,
    ].join("\n");
  }

  /* ── daily_phrase: Calm editorial ──────────────────────────── */

  private renderDailyPhrase(input: ShareImageRenderInput, w: number, h: number): string {
    const { bg, accent, badge, pattern } = cfg(input);
    const solidBg = bg || "#fefce8";
    // cfg() defaults fg to #e2e8f0 (light gray) — unreadable on this light bg.
    // Read brandFg from config directly; default to dark text for the light background.
    const fg = (input.config.brandFg as string) || "#1c1917";
    const s = w / 1200;

    return [
      `<rect width="100%" height="100%" fill="${escapeXml(solidBg)}"/>`,
      patternFor("daily_phrase", pattern, w, h),

      // Vertical accent bar left edge
      `<rect x="0" y="0" width="${4 * s}" height="${h}" fill="${escapeXml(accent)}"/>`,

      // Badge top center
      `<text x="${w / 2}" y="${64 * s}" font-size="${24 * s}" font-family="${JP_FONT}" fill="${escapeXml(fg)}" opacity="0.4" text-anchor="middle">${escapeXml(badge)}</text>`,

      // Headline centered
      foreignText(
        80 * s, h * 0.28, w - 160 * s, 200 * s,
        escapeHtml(input.headline),
        `font-family:${JP_FONT};font-size:${56 * s}px;font-weight:700;color:${escapeHtml(fg)};text-align:center;line-height:1.8;overflow:hidden;`,
      ),

      // Sub
      foreignText(
        80 * s, h * 0.62, w - 160 * s, 100 * s,
        escapeHtml(input.sub),
        `font-family:${JP_FONT};font-size:${28 * s}px;color:${escapeHtml(fg)};opacity:0.6;text-align:center;line-height:1.5;overflow:hidden;`,
      ),

      // Kind label bottom-right
      `<text x="${w - 64 * s}" y="${h - 32 * s}" font-size="${20 * s}" font-family="${JP_FONT}" fill="${escapeXml(fg)}" opacity="0.3" text-anchor="end">日本語フレーズ</text>`,
    ].join("\n");
  }

  /* ── battle: Competitive energy ────────────────────────────── */

  private renderBattle(input: ShareImageRenderInput, w: number, h: number): string {
    const { bg, bgEnd, fg, accent, badge, pattern } = cfg(input);
    const bgStart = bg || "#1e1b4b";
    const bgStop = bgEnd || "#312e81";
    const s = w / 1200;

    const hlY = h * 0.44;
    const glowH = 90 * s;

    return [
      gradientOrSolid("battleGrad", bgStart, bgStop, "diagonal"),
      patternFor("battle", pattern, w, h),

      // Diagonal accent lines behind headline
      `<line x1="${w * 0.1}" y1="${h * 0.15}" x2="${w * 0.9}" y2="${h * 0.75}" stroke="${escapeXml(accent)}" stroke-width="${2 * s}" opacity="0.15"/>`,
      `<line x1="${w * 0.9}" y1="${h * 0.15}" x2="${w * 0.1}" y2="${h * 0.75}" stroke="${escapeXml(accent)}" stroke-width="${2 * s}" opacity="0.15"/>`,

      // Electric glow behind headline
      `<rect x="${w * 0.1}" y="${hlY - glowH / 2}" width="${w * 0.8}" height="${glowH}" rx="${12 * s}" fill="${escapeXml(accent)}" opacity="0.12"/>`,

      // Badge
      `<text x="${64 * s}" y="${72 * s}" font-size="${28 * s}" font-family="${JP_FONT}" font-weight="700" fill="${escapeXml(accent)}">${escapeXml(badge)}</text>`,

      // Headline massive center
      foreignText(
        64 * s, hlY - 50 * s, w - 128 * s, 100 * s,
        escapeHtml(input.headline),
        `font-family:${JP_FONT};font-size:${72 * s}px;font-weight:800;color:${escapeHtml(accent)};text-align:center;line-height:1.1;overflow:hidden;`,
      ),

      // Sub
      foreignText(
        64 * s, h * 0.58, w - 128 * s, 80 * s,
        escapeHtml(input.sub),
        `font-family:${JP_FONT};font-size:${36 * s}px;color:${escapeHtml(fg)};text-align:center;line-height:1.3;overflow:hidden;`,
      ),
    ].join("\n");
  }
}
