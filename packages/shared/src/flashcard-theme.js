import { z } from "zod";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SAFE_BACKGROUND = /^(#[0-9a-f]{6}|linear-gradient\([^;{}]+\))$/i;
const hexColorSchema = z.string().regex(HEX_COLOR, "must be a six-digit hex color");
export const flashcardThemeConfigSchema = z
    .object({
    accent: hexColorSchema,
    accentForeground: hexColorSchema,
    background: z.string().regex(SAFE_BACKGROUND, "must be a hex color or safe linear-gradient"),
    border: hexColorSchema,
    contentSurface: hexColorSchema,
    controlBackground: hexColorSchema,
    controlForeground: hexColorSchema,
    focusRing: hexColorSchema,
    foreground: hexColorSchema,
    mutedForeground: hexColorSchema,
    overlay: hexColorSchema.optional(),
    borderRadius: z.string().max(32).optional(),
    flipAnimation: z.enum(["rotateX", "rotateY"]).optional(),
    fontFamily: z.string().max(160).optional(),
    shadow: z.string().max(240).optional()
})
    .strict();
export const FLASHCARD_THEME_DEFINITIONS = [
    {
        slug: "minimal-ink",
        nameKey: "flashcard_style.minimal_ink",
        descriptionKey: "flashcard_style.minimal_ink_desc",
        tier: "free",
        sortOrder: 1,
        status: "active",
        config: {
            background: "#ffffff",
            contentSurface: "#ffffff",
            foreground: "#111827",
            mutedForeground: "#4b5563",
            border: "#64748b",
            accent: "#1d4ed8",
            accentForeground: "#ffffff",
            controlBackground: "#111827",
            controlForeground: "#ffffff",
            focusRing: "#2563eb",
            fontFamily: "'Noto Sans JP', sans-serif",
            borderRadius: "16px",
            flipAnimation: "rotateY",
            shadow: "0 4px 24px rgba(0,0,0,0.08)"
        }
    },
    {
        slug: "warm-paper",
        nameKey: "flashcard_style.warm_paper",
        descriptionKey: "flashcard_style.warm_paper_desc",
        tier: "free",
        sortOrder: 2,
        status: "active",
        config: {
            background: "#faf6f1",
            contentSurface: "#faf6f1",
            foreground: "#3d3225",
            mutedForeground: "#66543f",
            border: "#75634d",
            accent: "#92400e",
            accentForeground: "#ffffff",
            controlBackground: "#78350f",
            controlForeground: "#ffffff",
            focusRing: "#92400e",
            fontFamily: "'Noto Serif JP', serif",
            borderRadius: "12px",
            flipAnimation: "rotateY",
            shadow: "0 2px 16px rgba(139,90,43,0.1)"
        }
    },
    {
        slug: "dark-focus",
        nameKey: "flashcard_style.dark_focus",
        descriptionKey: "flashcard_style.dark_focus_desc",
        tier: "free",
        sortOrder: 3,
        status: "active",
        config: {
            background: "#1e1e2e",
            contentSurface: "#1e1e2e",
            foreground: "#f8fafc",
            mutedForeground: "#cbd5e1",
            border: "#94a3b8",
            accent: "#c4b5fd",
            accentForeground: "#1e1e2e",
            controlBackground: "#f8fafc",
            controlForeground: "#1e1e2e",
            focusRing: "#c4b5fd",
            fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
            borderRadius: "20px",
            flipAnimation: "rotateY",
            shadow: "0 8px 32px rgba(0,0,0,0.4)"
        }
    },
    {
        slug: "sakura-bloom",
        nameKey: "flashcard_style.sakura_bloom",
        descriptionKey: "flashcard_style.sakura_bloom_desc",
        tier: "premium",
        sortOrder: 10,
        status: "active",
        config: {
            background: "linear-gradient(135deg, #fff5f7 0%, #ffe4ec 100%)",
            contentSurface: "#fff5f7",
            foreground: "#4a1942",
            mutedForeground: "#74405f",
            border: "#82536b",
            accent: "#9d174d",
            accentForeground: "#ffffff",
            controlBackground: "#9d174d",
            controlForeground: "#ffffff",
            focusRing: "#9d174d",
            overlay: "#fff5f7",
            fontFamily: "'Zen Maru Gothic', 'Noto Sans JP', sans-serif",
            borderRadius: "24px",
            flipAnimation: "rotateX",
            shadow: "0 8px 40px rgba(157,23,77,0.16)"
        }
    },
    {
        slug: "neon-tokyo",
        nameKey: "flashcard_style.neon_tokyo",
        descriptionKey: "flashcard_style.neon_tokyo_desc",
        tier: "premium",
        sortOrder: 11,
        status: "active",
        config: {
            background: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
            contentSurface: "#17152b",
            foreground: "#f1f5f9",
            mutedForeground: "#c7d2fe",
            border: "#94a3b8",
            accent: "#4ade80",
            accentForeground: "#0f172a",
            controlBackground: "#4ade80",
            controlForeground: "#0f172a",
            focusRing: "#5eead4",
            overlay: "#17152b",
            fontFamily: "'M PLUS 1', 'Inter', sans-serif",
            borderRadius: "8px",
            flipAnimation: "rotateY",
            shadow: "0 0 30px rgba(74,222,128,0.2), inset 0 1px 0 rgba(255,255,255,0.05)"
        }
    },
    {
        slug: "ocean-calm",
        nameKey: "flashcard_style.ocean_calm",
        descriptionKey: "flashcard_style.ocean_calm_desc",
        tier: "premium",
        sortOrder: 12,
        status: "active",
        config: {
            background: "linear-gradient(180deg, #e0f7fa 0%, #b2ebf2 100%)",
            contentSurface: "#e0f7fa",
            foreground: "#003b49",
            mutedForeground: "#285c66",
            border: "#4f6f76",
            accent: "#07566b",
            accentForeground: "#ffffff",
            controlBackground: "#07566b",
            controlForeground: "#ffffff",
            focusRing: "#07566b",
            overlay: "#e0f7fa",
            fontFamily: "'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif",
            borderRadius: "28px",
            flipAnimation: "rotateX",
            shadow: "0 12px 48px rgba(7,86,107,0.14)"
        }
    },
    {
        slug: "gold-calligraphy",
        nameKey: "flashcard_style.gold_calligraphy",
        descriptionKey: "flashcard_style.gold_calligraphy_desc",
        tier: "exclusive",
        sortOrder: 50,
        status: "active",
        config: {
            background: "linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 100%)",
            contentSurface: "#1a1a1a",
            foreground: "#f5e6c8",
            mutedForeground: "#d6c7aa",
            border: "#a78f61",
            accent: "#e6c36a",
            accentForeground: "#1a1a1a",
            controlBackground: "#f5e6c8",
            controlForeground: "#1a1a1a",
            focusRing: "#ffd978",
            overlay: "#1a1a1a",
            fontFamily: "'Shippori Mincho', 'Noto Serif JP', serif",
            borderRadius: "4px",
            flipAnimation: "rotateY",
            shadow: "0 4px 20px rgba(230,195,106,0.22), inset 0 1px 0 rgba(230,195,106,0.12)"
        }
    }
];
export const DEFAULT_FLASHCARD_THEME = FLASHCARD_THEME_DEFINITIONS[0];
export function resolveFlashcardThemeDefinition(slug) {
    return (FLASHCARD_THEME_DEFINITIONS.find((theme) => theme.slug === slug) ?? DEFAULT_FLASHCARD_THEME);
}
function hexToRgb(hex) {
    if (!HEX_COLOR.test(hex))
        throw new Error(`Unsupported color: ${hex}`);
    return [
        Number.parseInt(hex.slice(1, 3), 16),
        Number.parseInt(hex.slice(3, 5), 16),
        Number.parseInt(hex.slice(5, 7), 16)
    ];
}
function linearChannel(channel) {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
export function relativeLuminance(color) {
    const [red, green, blue] = hexToRgb(color).map(linearChannel);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
export function contrastRatio(foreground, background) {
    const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
    const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
    return (lighter + 0.05) / (darker + 0.05);
}
const CONTRAST_PAIRS = [
    ["primary text/content surface", "foreground", "contentSurface", 4.5],
    ["secondary text/content surface", "mutedForeground", "contentSurface", 4.5],
    ["accent foreground/accent", "accentForeground", "accent", 4.5],
    ["control foreground/control background", "controlForeground", "controlBackground", 4.5],
    ["border/content surface", "border", "contentSurface", 3],
    ["focus ring/content surface", "focusRing", "contentSurface", 3]
];
export function validateFlashcardTheme(themeId, input) {
    const parsed = flashcardThemeConfigSchema.safeParse(input);
    if (!parsed.success) {
        return {
            contrast: [],
            errors: parsed.error.issues.map((issue) => `${themeId}.${issue.path.join(".") || "config"}: ${issue.message}`),
            success: false
        };
    }
    const contrast = CONTRAST_PAIRS.map(([pair, foregroundKey, backgroundKey, minimum]) => {
        const foreground = parsed.data[foregroundKey];
        const background = parsed.data[backgroundKey];
        const ratio = contrastRatio(foreground, background);
        return { background, foreground, minimum, pair, ratio };
    });
    const errors = contrast
        .filter((result) => result.ratio < result.minimum)
        .map((result) => `${themeId}: ${result.pair} ${result.foreground}/${result.background} is ${result.ratio.toFixed(2)}:1; requires ${result.minimum.toFixed(1)}:1`);
    return { contrast, errors, success: errors.length === 0 };
}
export function parseFlashcardThemeConfig(input) {
    return flashcardThemeConfigSchema.parse(input);
}
export function safeFlashcardThemeConfig(input) {
    const parsed = flashcardThemeConfigSchema.safeParse(input);
    if (!parsed.success)
        return DEFAULT_FLASHCARD_THEME.config;
    return parsed.data;
}
