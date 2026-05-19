import sharp from "sharp";

export type ShareRenderKind =
  | "streak"
  | "level_up"
  | "bjt_pass"
  | "bjt_result"
  | "battle_win"
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

/** Truncate text to fit approximately within a given width (chars estimate) */
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + "…";
}

/** Render text as SVG <text> with optional attributes */
function svgText(opts: {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
  fontWeight?: string;
  anchor?: "start" | "middle" | "end";
  opacity?: number;
  letterSpacing?: number;
  maxChars?: number;
}): string {
  const t = opts.maxChars ? truncate(opts.text, opts.maxChars) : opts.text;
  const attrs = [
    `x="${opts.x}"`,
    `y="${opts.y}"`,
    `font-size="${opts.fontSize}"`,
    `font-family="${JP_FONT}"`,
    `fill="${escapeXml(opts.fill)}"`,
  ];
  if (opts.fontWeight) attrs.push(`font-weight="${opts.fontWeight}"`);
  if (opts.anchor) attrs.push(`text-anchor="${opts.anchor}"`);
  if (opts.opacity != null) attrs.push(`opacity="${opts.opacity}"`);
  if (opts.letterSpacing) attrs.push(`letter-spacing="${opts.letterSpacing}"`);
  return `<text ${attrs.join(" ")}>${escapeXml(t)}</text>`;
}

/* ── Pattern generators ─────────────────────────────────────── */

/** Determine pattern overlay color based on background brightness */
function patternColor(bgHex: string): string {
  const hex = bgHex.replace("#", "");
  if (hex.length < 6) return "white";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? "black" : "white";
}

function patternDots(w: number, h: number, color: string, opacity = 0.12): string {
  const spacing = 44;
  const cols = Math.ceil(w / spacing);
  const rows = Math.ceil(h / spacing);
  let circles = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      circles += `<circle cx="${c * spacing + spacing / 2}" cy="${r * spacing + spacing / 2}" r="3.5" fill="${color}"/>`;
    }
  }
  return `<g opacity="${opacity}">${circles}</g>`;
}

function patternGrid(w: number, h: number, color: string, opacity = 0.08): string {
  let lines = "";
  for (let x = 0; x <= w; x += 60) {
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${color}" stroke-width="0.7"/>`;
  }
  for (let y = 0; y <= h; y += 60) {
    lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${color}" stroke-width="0.7"/>`;
  }
  return `<g opacity="${opacity}">${lines}</g>`;
}

function patternWaves(w: number, h: number, color: string, opacity = 0.10): string {
  let paths = "";
  for (let y = 60; y < h; y += 100) {
    paths += `<path d="M0,${y} Q${w * 0.25},${y - 35} ${w * 0.5},${y} T${w},${y}" fill="none" stroke="${color}" stroke-width="1.8"/>`;
  }
  return `<g opacity="${opacity}">${paths}</g>`;
}

function patternStripes(w: number, h: number, color: string, opacity = 0.10): string {
  let lines = "";
  const spacing = 36;
  const diag = Math.ceil(Math.hypot(w, h));
  for (let i = -diag; i < diag; i += spacing) {
    lines += `<line x1="${i}" y1="0" x2="${i + h}" y2="${h}" stroke="${color}" stroke-width="8"/>`;
  }
  return `<g opacity="${opacity}">${lines}</g>`;
}

function patternDiamonds(w: number, h: number, color: string, opacity = 0.09): string {
  let shapes = "";
  const sx = 70;
  const sy = 70;
  const r = 14;
  const cols = Math.ceil(w / sx) + 1;
  const rows = Math.ceil(h / sy) + 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * sx + (row % 2 === 0 ? 0 : sx / 2);
      const cy = row * sy;
      shapes += `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" fill="none" stroke="${color}" stroke-width="1.2"/>`;
    }
  }
  return `<g opacity="${opacity}">${shapes}</g>`;
}

function patternCircles(w: number, h: number, color: string, opacity = 0.07): string {
  let shapes = "";
  const spacing = 90;
  const cols = Math.ceil(w / spacing) + 1;
  const rows = Math.ceil(h / spacing) + 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * spacing + (row % 2 === 0 ? 0 : spacing / 2);
      const cy = row * spacing;
      shapes += `<circle cx="${cx}" cy="${cy}" r="20" fill="none" stroke="${color}" stroke-width="1.2"/>`;
    }
  }
  return `<g opacity="${opacity}">${shapes}</g>`;
}

function patternZigzag(w: number, h: number, color: string, opacity = 0.10): string {
  let paths = "";
  const amp = 20;
  const period = 50;
  for (let y = 40; y < h; y += 80) {
    let d = `M0,${y}`;
    for (let x = 0; x <= w; x += period) {
      const dy = (x / period) % 2 === 0 ? y - amp : y + amp;
      d += ` L${x},${dy}`;
    }
    paths += `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
  }
  return `<g opacity="${opacity}">${paths}</g>`;
}

function patternCrosshatch(w: number, h: number, color: string, opacity = 0.07): string {
  let lines = "";
  const spacing = 30;
  const diag = Math.ceil(Math.hypot(w, h));
  for (let i = -diag; i < diag; i += spacing) {
    lines += `<line x1="${i}" y1="0" x2="${i + h}" y2="${h}" stroke="${color}" stroke-width="0.8"/>`;
    lines += `<line x1="${i + h}" y1="0" x2="${i}" y2="${h}" stroke="${color}" stroke-width="0.8"/>`;
  }
  return `<g opacity="${opacity}">${lines}</g>`;
}

function patternSakura(w: number, h: number, color: string, opacity = 0.12): string {
  // Scattered sakura petal shapes
  let petals = "";
  const positions = [
    [0.08, 0.12], [0.25, 0.08], [0.45, 0.15], [0.7, 0.05], [0.88, 0.18],
    [0.05, 0.45], [0.35, 0.55], [0.6, 0.42], [0.82, 0.5], [0.95, 0.35],
    [0.12, 0.78], [0.3, 0.85], [0.55, 0.75], [0.75, 0.88], [0.92, 0.72],
  ];
  for (const [px, py] of positions) {
    const cx = px * w;
    const cy = py * h;
    const s = 8 + Math.abs(Math.sin(px * 17 + py * 13)) * 6;
    petals += `<ellipse cx="${cx}" cy="${cy}" rx="${s}" ry="${s * 0.6}" fill="${color}"/>`;
    petals += `<ellipse cx="${cx + s * 0.5}" cy="${cy + s * 0.3}" rx="${s * 0.6}" ry="${s}" fill="${color}"/>`;
  }
  return `<g opacity="${opacity}">${petals}</g>`;
}

function patternFor(
  kind: string,
  override: string,
  w: number,
  h: number,
  bgColor: string,
): string {
  const key =
    override && override !== "none"
      ? override
      : { streak: "dots", bjt_result: "grid", daily_phrase: "waves", battle: "stripes" }[kind] || "none";
  if (key === "none") return "";
  const color = patternColor(bgColor);
  if (key === "dots") return patternDots(w, h, color);
  if (key === "grid") return patternGrid(w, h, color);
  if (key === "waves") return patternWaves(w, h, color);
  if (key === "stripes") return patternStripes(w, h, color);
  if (key === "diamonds") return patternDiamonds(w, h, color);
  if (key === "circles") return patternCircles(w, h, color);
  if (key === "zigzag") return patternZigzag(w, h, color);
  if (key === "crosshatch") return patternCrosshatch(w, h, color);
  if (key === "sakura") return patternSakura(w, h, color);
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
      case "bjt_pass":
        svgBody = this.renderBjtResult(input, w, h);
        break;
      case "daily_phrase":
        svgBody = this.renderDailyPhrase(input, w, h);
        break;
      case "battle":
      case "battle_win":
        svgBody = this.renderBattle(input, w, h);
        break;
      case "level_up":
      default:
        svgBody = this.renderStreak(input, w, h);
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
      patternFor("streak", pattern, w, h, bgStart),

      // Badge
      svgText({ x: 64 * s, y: 72 * s, text: badge, fontSize: 28 * s, fill: accent, fontWeight: "700" }),

      // Flame + streak number center
      flameIcon(w / 2 - 100 * s, h * 0.42, 80 * s, accent),
      streakNum
        ? svgText({ x: w / 2, y: h * 0.46, text: streakNum, fontSize: 80 * s, fill: fg, fontWeight: "800", anchor: "middle" })
        : "",

      // Headline
      svgText({ x: w / 2, y: h * 0.60, text: input.headline, fontSize: 44 * s, fill: fg, fontWeight: "700", anchor: "middle", maxChars: 40 }),

      // Sub
      svgText({ x: w / 2, y: h * 0.74, text: input.sub, fontSize: 30 * s, fill: fg, anchor: "middle", opacity: 0.8, maxChars: 50 }),

      // Kind label bottom-left
      svgText({ x: 64 * s, y: h - 32 * s, text: "STREAK", fontSize: 20 * s, fill: fg, opacity: 0.4, letterSpacing: 4 }),
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
      patternFor("bjt_result", pattern, w, h, bgStart),

      // Badge
      svgText({ x: 64 * s, y: 72 * s, text: badge, fontSize: 28 * s, fill: accent, fontWeight: "700" }),

      // Band circle
      `<circle cx="${circleCx}" cy="${circleCy}" r="${circleR}" fill="none" stroke="${escapeXml(accent)}" stroke-width="${3 * s}"/>`,
      band
        ? svgText({ x: circleCx, y: circleCy + 14 * s, text: band, fontSize: 40 * s, fill: accent, fontWeight: "800", anchor: "middle" })
        : "",

      // Headline
      svgText({ x: circleCx + circleR + 40 * s, y: h * 0.40, text: input.headline, fontSize: 48 * s, fill: fg, fontWeight: "700", maxChars: 30 }),

      // Sub
      svgText({ x: circleCx + circleR + 40 * s, y: h * 0.58, text: input.sub, fontSize: 30 * s, fill: fg, opacity: 0.8, maxChars: 45 }),

      // Bottom accent line
      `<line x1="${64 * s}" y1="${h - 60 * s}" x2="${w - 64 * s}" y2="${h - 60 * s}" stroke="${escapeXml(accent)}" stroke-width="${2 * s}" opacity="0.6"/>`,
    ].join("\n");
  }

  /* ── daily_phrase: Calm editorial ──────────────────────────── */

  private renderDailyPhrase(input: ShareImageRenderInput, w: number, h: number): string {
    const { bg, accent, badge, pattern } = cfg(input);
    const solidBg = bg || "#fefce8";
    const fg = (input.config.brandFg as string) || "#1c1917";
    const s = w / 1200;

    return [
      `<rect width="100%" height="100%" fill="${escapeXml(solidBg)}"/>`,
      patternFor("daily_phrase", pattern, w, h, solidBg),

      // Vertical accent bar left edge
      `<rect x="0" y="0" width="${4 * s}" height="${h}" fill="${escapeXml(accent)}"/>`,

      // Badge top center
      svgText({ x: w / 2, y: 64 * s, text: badge, fontSize: 24 * s, fill: fg, opacity: 0.4, anchor: "middle" }),

      // Headline centered
      svgText({ x: w / 2, y: h * 0.42, text: input.headline, fontSize: 48 * s, fill: fg, fontWeight: "700", anchor: "middle", maxChars: 35 }),

      // Sub
      svgText({ x: w / 2, y: h * 0.62, text: input.sub, fontSize: 28 * s, fill: fg, anchor: "middle", opacity: 0.6, maxChars: 50 }),

      // Kind label bottom-right
      svgText({ x: w - 64 * s, y: h - 32 * s, text: "日本語フレーズ", fontSize: 20 * s, fill: fg, opacity: 0.3, anchor: "end" }),
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
      patternFor("battle", pattern, w, h, bgStart),

      // Diagonal accent lines behind headline
      `<line x1="${w * 0.1}" y1="${h * 0.15}" x2="${w * 0.9}" y2="${h * 0.75}" stroke="${escapeXml(accent)}" stroke-width="${2 * s}" opacity="0.15"/>`,
      `<line x1="${w * 0.9}" y1="${h * 0.15}" x2="${w * 0.1}" y2="${h * 0.75}" stroke="${escapeXml(accent)}" stroke-width="${2 * s}" opacity="0.15"/>`,

      // Electric glow behind headline
      `<rect x="${w * 0.1}" y="${hlY - glowH / 2}" width="${w * 0.8}" height="${glowH}" rx="${12 * s}" fill="${escapeXml(accent)}" opacity="0.12"/>`,

      // Badge
      svgText({ x: 64 * s, y: 72 * s, text: badge, fontSize: 28 * s, fill: accent, fontWeight: "700" }),

      // Headline massive center
      svgText({ x: w / 2, y: hlY + 12 * s, text: input.headline, fontSize: 64 * s, fill: accent, fontWeight: "800", anchor: "middle", maxChars: 25 }),

      // Sub
      svgText({ x: w / 2, y: h * 0.62, text: input.sub, fontSize: 34 * s, fill: fg, anchor: "middle", maxChars: 40 }),
    ].join("\n");
  }
}
