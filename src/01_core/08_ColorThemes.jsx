/**
 * @fileoverview Material 3 inspired colour-theme engine (JSX-free, side-effect free).
 *
 * Every Tailwind colour utility used by the app (`bg-slate-50`, `text-rose-950`, `border-blue-200`, …)
 * is re-pointed by the stamped Tailwind config to a CSS custom property such as
 * `rgb(var(--tw-slate-50, 248 250 252) / <alpha-value>)`. Themes therefore work in three layers:
 *
 *   1. **Seeds** – one mid-tone hex per palette (`primary`, `neutral`, `male`, `female`, …).
 *   2. **Tonal palettes** – CIELAB lightness ("tone") ramps generated from each seed, mapped onto the
 *      22 Tailwind families (`slate` → neutral, `sky` → male, `rose` → female, `red` → error, …) and
 *      onto the Material 3 colour roles (`primary`, `on-primary`, `surface-container-low`, …).
 *   3. **CSS variables** – `applyColorTheme()` writes `--tw-<family>-<shade>` and
 *      `--md-sys-color-<role>` triplets onto `<html>`; the Classic theme sets no `--tw-*` variables at
 *      all, so the fallbacks (Tailwind's stock palette) keep it pixel-identical to the original design.
 */

/** Tailwind's stock v3 palette – also the fallback values baked into the config script. */
const TAILWIND_DEFAULT_PALETTE = {
    slate: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
    gray: { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712' },
    zinc: { 50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b' },
    neutral: { 50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4', 400: '#a3a3a3', 500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0a0a0a' },
    stone: { 50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1', 400: '#a8a29e', 500: '#78716c', 600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917', 950: '#0c0a09' },
    red: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a' },
    orange: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407' },
    amber: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03' },
    yellow: { 50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e', 900: '#713f12', 950: '#422006' },
    lime: { 50: '#f7fee7', 100: '#ecfccb', 200: '#d9f99d', 300: '#bef264', 400: '#a3e635', 500: '#84cc16', 600: '#65a30d', 700: '#4d7c0f', 800: '#3f6212', 900: '#365314', 950: '#1a2e05' },
    green: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16' },
    emerald: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22' },
    teal: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e' },
    cyan: { 50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75', 900: '#164e63', 950: '#083344' },
    sky: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49' },
    blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' },
    indigo: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b' },
    violet: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065' },
    purple: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764' },
    fuchsia: { 50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 400: '#e879f9', 500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 800: '#86198f', 900: '#701a75', 950: '#4a044e' },
    pink: { 50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6', 500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843', 950: '#500724' },
    rose: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519' },
    white: '#ffffff'
};

/** The 22 Tailwind colour families that get re-pointed to CSS variables. */
const TAILWIND_THEME_FAMILIES = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
const TAILWIND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/** Which theme seed paints each Tailwind family (sky = male cards, rose/pink = female cards, …). */
const TAILWIND_FAMILY_SEEDS = {
    slate: 'neutral', gray: 'neutral', zinc: 'neutral', neutral: 'neutral', stone: 'neutral',
    red: 'error', orange: 'warning', amber: 'warning', yellow: 'warning',
    lime: 'success', green: 'success', emerald: 'success', teal: 'success',
    cyan: 'secondary', sky: 'male', blue: 'accent', indigo: 'accent',
    violet: 'tertiary', purple: 'tertiary', fuchsia: 'tertiary', pink: 'female', rose: 'female'
};

/** CIELAB lightness ("tone") per Tailwind shade – `light` mirrors Tailwind's own ramp, `dark` inverts it. */
const TAILWIND_SHADE_TONES = {
    light: { 50: 98, 100: 96, 200: 92, 300: 85, 400: 67, 500: 49, 600: 37, 700: 28, 800: 17, 900: 10, 950: 4, white: 100 },
    dark: { 50: 15, 100: 27, 200: 34, 300: 43, 400: 53, 500: 63, 600: 74, 700: 83, 800: 89, 900: 94, 950: 98, white: 6 }
};

/** Material 3 colour-role tones (https://m3.material.io/styles/color/static/baseline). */
const M3_ROLE_TONES = {
    light: {
        primary: 40, onPrimary: 100, primaryContainer: 90, onPrimaryContainer: 10, inversePrimary: 80,
        secondary: 40, onSecondary: 100, secondaryContainer: 90, onSecondaryContainer: 10,
        tertiary: 40, onTertiary: 100, tertiaryContainer: 90, onTertiaryContainer: 10,
        error: 40, onError: 100, errorContainer: 90, onErrorContainer: 10,
        surface: 98, surfaceDim: 87, surfaceBright: 98, surfaceContainerLowest: 100, surfaceContainerLow: 96,
        surfaceContainer: 94, surfaceContainerHigh: 92, surfaceContainerHighest: 90, surfaceVariant: 90,
        onSurface: 10, onSurfaceVariant: 30, outline: 50, outlineVariant: 80, inverseSurface: 20, inverseOnSurface: 95
    },
    dark: {
        primary: 80, onPrimary: 20, primaryContainer: 30, onPrimaryContainer: 90, inversePrimary: 40,
        secondary: 80, onSecondary: 20, secondaryContainer: 30, onSecondaryContainer: 90,
        tertiary: 80, onTertiary: 20, tertiaryContainer: 30, onTertiaryContainer: 90,
        error: 80, onError: 20, errorContainer: 30, onErrorContainer: 90,
        surface: 6, surfaceDim: 6, surfaceBright: 24, surfaceContainerLowest: 4, surfaceContainerLow: 10,
        surfaceContainer: 12, surfaceContainerHigh: 17, surfaceContainerHighest: 22, surfaceVariant: 30,
        onSurface: 90, onSurfaceVariant: 80, outline: 60, outlineVariant: 30, inverseSurface: 90, inverseOnSurface: 20
    }
};

const DEFAULT_COLOR_THEME_ID = 'classic';
const COLOR_THEME_PREVIEW_SHADES = { cardFill: 100, cardBorder: 300, cardText: 950 };

// ─── Colour maths (sRGB ⇄ CIELAB ⇄ LCh) ────────────────────────────────────────

/**
 * Parses a 3- or 6-digit hex colour into an `[r, g, b]` triplet (0–255), or `null` when malformed.
 *
 * @example hexToRgb('#5c7c33') // → [92, 124, 51]
 * @example hexToRgb('fff')     // → [255, 255, 255]
 * @example hexToRgb('nope')    // → null
 * @param {string} hex
 * @returns {number[]|null}
 */
function hexToRgb(hex) {
    const clean = String(hex || '').trim().replace(/^#/, '');
    const full = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
    const value = parseInt(full, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Formats an `[r, g, b]` triplet (fractional / out-of-range values are rounded and clamped) as `#rrggbb`.
 *
 * @example rgbToHex([92, 124, 51])      // → '#5c7c33'
 * @example rgbToHex([255.4, -3, 300])   // → '#ff00ff'
 * @param {number[]} rgb
 * @returns {string}
 */
function rgbToHex(rgb) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + rgb.map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

/**
 * Returns the space-separated `r g b` triplet Tailwind expects inside `rgb(var(--x) / <alpha>)`.
 *
 * @example rgbTriplet('#5c7c33') // → '92 124 51'
 * @example rgbTriplet('#fff')    // → '255 255 255'
 * @param {string} hex
 * @returns {string}
 */
function rgbTriplet(hex) {
    const rgb = hexToRgb(hex);
    return rgb ? rgb.join(' ') : '0 0 0';
}

/**
 * Converts one 0–255 sRGB channel to linear light (0–1).
 *
 * @example srgbToLinear(255) // → 1
 * @example srgbToLinear(0)   // → 0
 * @param {number} channel
 * @returns {number}
 */
function srgbToLinear(channel) {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Converts linear light back to a 0–255 sRGB channel; negative inputs stay negative so gamut checks work.
 *
 * @example linearToSrgb(1)    // → 255
 * @example linearToSrgb(-0.1) // → a negative number (out of gamut)
 * @param {number} linear
 * @returns {number}
 */
function linearToSrgb(linear) {
    const sign = linear < 0 ? -1 : 1;
    const abs = Math.abs(linear);
    const c = abs <= 0.0031308 ? abs * 12.92 : 1.055 * Math.pow(abs, 1 / 2.4) - 0.055;
    return sign * c * 255;
}

/**
 * sRGB → CIELAB (D65 white point). `L*` ranges 0 (black) … 100 (white).
 *
 * @example rgbToLab([255, 255, 255])[0] // → 100 (±0.01)
 * @example rgbToLab([0, 0, 0])[0]       // → 0
 * @param {number[]} rgb
 * @returns {number[]} `[L, a, b]`
 */
function rgbToLab(rgb) {
    const [r, g, b] = rgb.map(srgbToLinear);
    const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
    const y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
    const z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const [fx, fy, fz] = [f(x), f(y), f(z)];
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * CIELAB → sRGB (unclamped so callers can detect out-of-gamut colours).
 *
 * @example rgbToHex(labToRgb([100, 0, 0])) // → '#ffffff'
 * @example rgbToHex(labToRgb(rgbToLab([92, 124, 51]))) // → '#5c7c33'
 * @param {number[]} lab `[L, a, b]`
 * @returns {number[]} `[r, g, b]`, possibly outside 0–255
 */
function labToRgb(lab) {
    const [L, a, b] = lab;
    const fy = (L + 16) / 116;
    const fx = fy + a / 500;
    const fz = fy - b / 200;
    const finv = (t) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
    const x = finv(fx) * 0.95047;
    const y = finv(fy);
    const z = finv(fz) * 1.08883;
    const rl = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
    const gl = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
    const bl = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
    return [rl, gl, bl].map(linearToSrgb);
}

/**
 * True when every channel lies within 0–255 (± a small rounding tolerance).
 *
 * @example isRgbInGamut([10, 20, 30])  // → true
 * @example isRgbInGamut([-5, 20, 30])  // → false
 * @param {number[]} rgb
 * @param {number} [tolerance=0.5]
 * @returns {boolean}
 */
function isRgbInGamut(rgb, tolerance = 0.5) {
    return rgb.every((v) => v >= -tolerance && v <= 255 + tolerance);
}

/**
 * Hex → cylindrical LCh (`l` 0–100, `c` chroma ≥ 0, `h` hue degrees 0–360).
 *
 * @example hexToLch('#808080').c // → ≈0 (grey has no chroma)
 * @example hexToLch('#ff0000').h // → ≈40 (CIELAB red hue angle)
 * @param {string} hex
 * @returns {{l: number, c: number, h: number}}
 */
function hexToLch(hex) {
    const lab = rgbToLab(hexToRgb(hex) || [0, 0, 0]);
    const chroma = Math.hypot(lab[1], lab[2]);
    const hue = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360;
    return { l: lab[0], c: chroma, h: hue };
}

/**
 * LCh → CIELAB `[L, a, b]`.
 *
 * @example lchToLab(50, 0, 120)   // → [50, 0, 0]
 * @example lchToLab(50, 10, 0)    // → [50, 10, 0]
 * @param {number} l
 * @param {number} c
 * @param {number} h degrees
 * @returns {number[]}
 */
function lchToLab(l, c, h) {
    const rad = h * Math.PI / 180;
    return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

/**
 * LCh → hex, reducing chroma (binary search, 16 steps) until the colour fits the sRGB gamut so
 * lightness is always honoured exactly.
 *
 * @example lchToHex(100, 0, 0)      // → '#ffffff'
 * @example lchToHex(50, 500, 120)   // → the most saturated in-gamut green at L*=50
 * @param {number} l
 * @param {number} c
 * @param {number} h
 * @returns {string}
 */
function lchToHex(l, c, h) {
    const safeL = Math.max(0, Math.min(100, l));
    if (safeL <= 0) return '#000000';
    if (safeL >= 100) return '#ffffff';
    if (isRgbInGamut(labToRgb(lchToLab(safeL, c, h)))) return rgbToHex(labToRgb(lchToLab(safeL, c, h)));
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (isRgbInGamut(labToRgb(lchToLab(safeL, mid, h)))) lo = mid; else hi = mid;
    }
    return rgbToHex(labToRgb(lchToLab(safeL, lo, h)));
}

/**
 * Chroma multiplier per tone: full chroma at mid tones, gently desaturated towards black and white
 * (Material tonal palettes behave the same way).
 *
 * @example chromaScaleForTone(50)  // → 1
 * @example chromaScaleForTone(100) // → 0.25
 * @param {number} tone 0–100
 * @returns {number}
 */
function chromaScaleForTone(tone) {
    const offset = (tone - 50) / 50;
    return 1 - 0.75 * offset * offset;
}

/**
 * Picks the colour of a seed's tonal palette at a given tone (CIELAB L*).
 *
 * @example toneHex('#5c7c33', 100) // → '#ffffff'
 * @example hexToLch(toneHex('#2563eb', 40)).l // → ≈40
 * @param {string} seedHex
 * @param {number} tone 0–100
 * @param {number} [chromaScale] defaults to `chromaScaleForTone(tone)`
 * @returns {string}
 */
function toneHex(seedHex, tone, chromaScale) {
    const seed = hexToLch(seedHex);
    const scale = chromaScale === undefined ? chromaScaleForTone(tone) : chromaScale;
    return lchToHex(tone, seed.c * scale, seed.h);
}

/**
 * WCAG relative luminance (0 black … 1 white).
 *
 * @example relativeLuminance('#ffffff') // → 1
 * @example relativeLuminance('#000000') // → 0
 * @param {string} hex
 * @returns {number}
 */
function relativeLuminance(hex) {
    const [r, g, b] = (hexToRgb(hex) || [0, 0, 0]).map(srgbToLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two colours (1 … 21).
 *
 * @example contrastRatio('#000000', '#ffffff') // → 21
 * @example contrastRatio('#777777', '#777777') // → 1
 * @param {string} hexA
 * @param {string} hexB
 * @returns {number}
 */
function contrastRatio(hexA, hexB) {
    const la = relativeLuminance(hexA);
    const lb = relativeLuminance(hexB);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Linear sRGB-space mix of two colours (`weight` 0 → all `hexA`, 1 → all `hexB`).
 *
 * @example mixHex('#000000', '#ffffff', 0.5) // → '#808080'
 * @example mixHex('#5c7c33', '#ffffff', 0)   // → '#5c7c33'
 * @param {string} hexA
 * @param {string} hexB
 * @param {number} weight
 * @returns {string}
 */
function mixHex(hexA, hexB, weight) {
    const a = hexToRgb(hexA) || [0, 0, 0];
    const b = hexToRgb(hexB) || [0, 0, 0];
    const w = Math.max(0, Math.min(1, weight));
    return rgbToHex(a.map((v, i) => v + (b[i] - v) * w));
}

// ─── Theme catalogue ───────────────────────────────────────────────────────────

/**
 * Builds the Solarized neutral ramp (base03 … base3) for either mode so `slate`/`gray`/… utilities
 * render Ethan Schoonover's exact base colours instead of generated greys.
 *
 * @example solarizedNeutralScale('light').white // → '#fdf6e3' (base3)
 * @example solarizedNeutralScale('dark').white  // → '#002b36' (base03)
 * @param {'light'|'dark'} mode
 * @returns {Object<string,string>} shade → hex, including `white`
 */
function solarizedNeutralScale(mode) {
    const [base03, base02, base01, base00, base0, base1, base2, base3] = ['#002b36', '#073642', '#586e75', '#657b83', '#839496', '#93a1a1', '#eee8d5', '#fdf6e3'];
    if (mode === 'dark') {
        return {
            white: base03, 50: base02, 100: mixHex(base02, base01, 0.45), 200: mixHex(base02, base01, 0.75), 300: base01,
            400: base00, 500: base0, 600: base1, 700: mixHex(base1, base2, 0.5), 800: base2, 900: base3, 950: '#fffbf0'
        };
    }
    return {
        white: base3, 50: mixHex(base3, base2, 0.5), 100: base2, 200: mixHex(base2, base1, 0.35), 300: mixHex(base2, base1, 0.7),
        400: base1, 500: base00, 600: base01, 700: mixHex(base01, base02, 0.5), 800: base02, 900: base03, 950: '#00212b'
    };
}

/**
 * Maps every neutral Tailwind family (slate, gray, zinc, neutral, stone) to one explicit ramp.
 *
 * @example neutralFamilyOverrides(solarizedNeutralScale('light')).slate[500] // → '#839496'
 * @example Object.keys(neutralFamilyOverrides({ 50: '#fff' })) // → ['slate','gray','zinc','neutral','stone','white']
 * @param {Object<string,string>} scale shade → hex (may include `white`)
 * @returns {Object}
 */
function neutralFamilyOverrides(scale) {
    const { white, ...shades } = scale;
    return { slate: shades, gray: shades, zinc: shades, neutral: shades, stone: shades, white };
}

const CLASSIC_FOREST_SEEDS = {
    primary: '#5c7c33', secondary: '#2563eb', tertiary: '#7c3aed', neutral: '#64748b', error: '#dc2626',
    accent: '#2563eb', male: '#0ea5e9', female: '#f43f5e', success: '#10b981', warning: '#f59e0b'
};

const SOLARIZED_SEEDS = {
    primary: '#268bd2', secondary: '#2aa198', tertiary: '#6c71c4', neutral: '#839496', error: '#dc322f',
    accent: '#268bd2', male: '#2aa198', female: '#d33682', success: '#859900', warning: '#b58900'
};

/**
 * All selectable themes. `families: null` = keep Tailwind's stock palette (Classic only); `roles`
 * override generated Material roles with the hand-picked brand colours of the original design.
 */
const COLOR_THEMES = [
    {
        id: 'classic', name: 'Classic Forest', mode: 'light', seeds: CLASSIC_FOREST_SEEDS, families: null,
        blurb: 'The original look: crisp white canvas, slate text and the forest-green brand accents.',
        roles: {
            primary: '#5c7c33', onPrimary: '#ffffff', primaryContainer: '#e9f2da', onPrimaryContainer: '#2d4a1e', inversePrimary: '#9cc95f', primaryHover: '#4a6a27',
            secondary: '#2563eb', onSecondary: '#ffffff', secondaryContainer: '#dbeafe', onSecondaryContainer: '#1e3a8a',
            tertiary: '#7c3aed', onTertiary: '#ffffff', tertiaryContainer: '#ede9fe', onTertiaryContainer: '#4c1d95',
            error: '#dc2626', onError: '#ffffff', errorContainer: '#fef2f2', onErrorContainer: '#991b1b',
            surface: '#ffffff', surfaceDim: '#e2e8f0', surfaceBright: '#ffffff', surfaceContainerLowest: '#ffffff', surfaceContainerLow: '#f8fafc',
            surfaceContainer: '#f1f5f9', surfaceContainerHigh: '#e2e8f0', surfaceContainerHighest: '#cbd5e1', surfaceVariant: '#f1f5f9',
            onSurface: '#1e293b', onSurfaceVariant: '#64748b', outline: '#cbd5e1', outlineVariant: '#e2e8f0', inverseSurface: '#0f172a', inverseOnSurface: '#f8fafc'
        }
    },
    {
        id: 'pastel', name: 'Soft Pastels', mode: 'light',
        blurb: 'Powdery mint, blush and lavender on a milky canvas – gentle on the eyes for long sessions.',
        seeds: { primary: '#5d9b8f', secondary: '#c98aa0', tertiary: '#9a8fc4', neutral: '#8f8a93', error: '#c86a6a', accent: '#7b93c9', male: '#7aa7cf', female: '#d49ab0', success: '#7ca982', warning: '#d4a85a' },
        shadeTones: { 50: 98, 100: 96, 200: 93, 300: 87, 400: 68, 500: 50, 600: 40, 700: 30, 800: 19, 900: 11 }
    },
    {
        id: 'earthy', name: 'Earthy & Warm', mode: 'light',
        blurb: 'Terracotta, olive and ochre over warm parchment – like an old family album.',
        seeds: { primary: '#9a5b2e', secondary: '#6f7b47', tertiary: '#b8603f', neutral: '#8a7d70', neutralVariant: '#8c7f6e', error: '#b23a3a', accent: '#8c6d3f', male: '#5f7f8c', female: '#c27a68', success: '#6f8f4e', warning: '#c2862b' },
        families: { white: '#fdfaf4' }
    },
    {
        id: 'ocean', name: 'Ocean Breeze', mode: 'light',
        blurb: 'Cool teal and sea-blue accents on airy, slightly bluish surfaces.',
        seeds: { primary: '#1f7a8c', secondary: '#3b6ea5', tertiary: '#2a9d8f', neutral: '#76808a', error: '#c0392b', accent: '#2f6fd6', male: '#3a86b8', female: '#d0677d', success: '#2e9e6b', warning: '#d9a441' }
    },
    {
        id: 'lavender', name: 'Lavender Dusk', mode: 'light',
        blurb: 'Violet and orchid accents with soft grey-lilac surfaces.',
        seeds: { primary: '#6d5bb5', secondary: '#9b6aa8', tertiary: '#c26f9a', neutral: '#837c90', error: '#c24b5a', accent: '#5f6fd1', male: '#6b8bd6', female: '#c97aa6', success: '#6a9a6a', warning: '#c99a4a' }
    },
    {
        id: 'solarized-light', name: 'Solarized Light', mode: 'light',
        blurb: 'Ethan Schoonover\u2019s precision palette: cream base3 canvas with the classic blue, cyan and magenta accents.',
        seeds: SOLARIZED_SEEDS, families: neutralFamilyOverrides(solarizedNeutralScale('light'))
    },
    {
        id: 'dark', name: 'Dark Forest', mode: 'dark',
        blurb: 'The Classic palette inverted: charcoal slate surfaces with luminous green accents.',
        seeds: CLASSIC_FOREST_SEEDS
    },
    {
        id: 'midnight', name: 'Midnight Black', mode: 'dark',
        blurb: 'True-black surfaces for OLED screens with muted, high-legibility accents.',
        seeds: { ...CLASSIC_FOREST_SEEDS, neutral: '#6b7280' },
        shadeTones: { white: 0, 50: 10, 100: 23, 200: 30, 300: 39 },
        roleTones: { surface: 0, surfaceDim: 0, surfaceContainerLowest: 0, surfaceContainerLow: 4, surfaceContainer: 8, surfaceContainerHigh: 12, surfaceContainerHighest: 17, surfaceBright: 22 }
    },
    {
        id: 'solarized-dark', name: 'Solarized Dark', mode: 'dark',
        blurb: 'The night-time Solarized: deep teal base03 canvas with the same accent hues.',
        seeds: SOLARIZED_SEEDS, families: neutralFamilyOverrides(solarizedNeutralScale('dark'))
    },
    {
        id: 'contrast', name: 'High Contrast', mode: 'light',
        blurb: 'Pure white, near-black text and saturated accents – maximum legibility.',
        seeds: { primary: '#2448a8', secondary: '#006d5b', tertiary: '#7a1fa2', neutral: '#777777', error: '#b00020', accent: '#1d4ed8', male: '#0b57a4', female: '#b0215f', success: '#087443', warning: '#9a5b00' },
        shadeTones: { 50: 99, 100: 97, 200: 93, 300: 85, 400: 60, 500: 42, 600: 30, 700: 20, 800: 10, 900: 4, 950: 0 },
        roleTones: { primary: 30, primaryContainer: 92, onPrimaryContainer: 5, onSurface: 0, onSurfaceVariant: 20, outline: 35, outlineVariant: 70, surface: 100, surfaceContainerLow: 98 }
    }
];

/**
 * Looks a theme definition up by id, falling back to Classic for unknown / missing ids.
 *
 * @example getColorThemeDefinition('midnight').mode // → 'dark'
 * @example getColorThemeDefinition('does-not-exist').id // → 'classic'
 * @param {string} id
 * @returns {Object}
 */
function getColorThemeDefinition(id) {
    return COLOR_THEMES.find((theme) => theme.id === id) || COLOR_THEMES[0];
}

/**
 * True when `id` names one of the selectable themes.
 *
 * @example isKnownColorThemeId('earthy') // → true
 * @example isKnownColorThemeId('')       // → false
 * @param {*} id
 * @returns {boolean}
 */
function isKnownColorThemeId(id) {
    return typeof id === 'string' && COLOR_THEMES.some((theme) => theme.id === id);
}

/**
 * Which seed palette paints a Material role (`onPrimaryContainer` → primary, `outline` → neutralVariant…).
 *
 * @example paletteKeyForRole('onSecondaryContainer') // → 'secondary'
 * @example paletteKeyForRole('surfaceContainerLow')  // → 'neutral'
 * @param {string} role camelCase Material role name
 * @returns {string}
 */
function paletteKeyForRole(role) {
    const base = role.replace(/^inverse/, '').replace(/^on/, '');
    const normalized = base.charAt(0).toLowerCase() + base.slice(1);
    for (const key of ['primary', 'secondary', 'tertiary', 'error']) {
        if (normalized.startsWith(key)) return key;
    }
    if (/^(surfaceVariant|outline)/.test(normalized)) return 'neutralVariant';
    return 'neutral';
}

/**
 * camelCase role → kebab-case CSS token (`surfaceContainerLow` → `surface-container-low`).
 *
 * @example kebabCaseRole('onPrimary')       // → 'on-primary'
 * @example kebabCaseRole('inversePrimary')  // → 'inverse-primary'
 * @param {string} role
 * @returns {string}
 */
function kebabCaseRole(role) {
    return role.replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase());
}

/**
 * Generates every Material role from the seeds (plus the derived `primaryHover` = primary mixed 12 %
 * towards on-primary, i.e. Material's hover state layer).
 *
 * @example buildThemeRoles(CLASSIC_FOREST_SEEDS, M3_ROLE_TONES.light).onPrimary // → '#ffffff'
 * @example hexToLch(buildThemeRoles(CLASSIC_FOREST_SEEDS, M3_ROLE_TONES.dark).surface).l // → ≈6
 * @param {Object<string,string>} seeds
 * @param {Object<string,number>} roleTones role → tone
 * @returns {Object<string,string>} role → hex
 */
function buildThemeRoles(seeds, roleTones) {
    const roles = {};
    for (const role of Object.keys(roleTones)) {
        const seedKey = paletteKeyForRole(role);
        const seed = seeds[seedKey] || seeds.neutral;
        roles[role] = toneHex(seed, roleTones[role]);
    }
    roles.primaryHover = mixHex(roles.primary, roles.onPrimary, 0.12);
    return roles;
}

/**
 * Returns the chroma multiplier for a Tailwind shade in a theme: in dark themes (`isDark`),
 * profile-card fills (`50..300`) and text (`800..950`) are softened so cards read as calm,
 * muted pastel surfaces rather than oversaturated neon blocks.
 *
 * @example shadeChromaMultiplier('sky', 100, true)  // → 0.34
 * @example shadeChromaMultiplier('sky', 100, false) // → 1
 * @param {string} family Tailwind family name
 * @param {number} shade Tailwind shade number
 * @param {boolean} isDark Whether the theme is a dark theme
 * @returns {number}
 */
function shadeChromaMultiplier(family, shade, isDark) {
    if (!isDark) return 1;
    if (TAILWIND_FAMILY_SEEDS[family] === 'neutral') return 0.35;
    if (shade <= 300) return 0.34;
    if (shade <= 700) return 0.55;
    return 0.45;
}

/**
 * Generates the 22 Tailwind family ramps (+ `white`) from the seeds, honouring explicit overrides.
 *
 * @example buildThemeFamilies(CLASSIC_FOREST_SEEDS, TAILWIND_SHADE_TONES.light).sky[100] // → a very light blue
 * @example buildThemeFamilies(CLASSIC_FOREST_SEEDS, TAILWIND_SHADE_TONES.dark, { white: '#000000' }).white // → '#000000'
 * @param {Object<string,string>} seeds
 * @param {Object<string,number>} tones shade → tone (must include `white`)
 * @param {Object} [overrides] family → shade map, or `white` → hex
 * @returns {Object}
 */
function buildThemeFamilies(seeds, tones, overrides) {
    const families = {};
    const isDark = Number(tones && tones.white) < 50;
    for (const family of TAILWIND_THEME_FAMILIES) {
        if (overrides && overrides[family]) {
            families[family] = { ...overrides[family] };
            continue;
        }
        const seed = seeds[TAILWIND_FAMILY_SEEDS[family]] || seeds.neutral;
        families[family] = {};
        for (const shade of TAILWIND_SHADES) {
            families[family][shade] = toneHex(seed, tones[shade], shadeChromaMultiplier(family, shade, isDark));
        }
    }
    families.white = (overrides && overrides.white) || toneHex(seeds.neutral, tones.white, 0.15);
    return families;
}

/**
 * Resolves a theme id (or inline definition) into concrete colours.
 *
 * @example resolveColorTheme('classic').families // → null (stock Tailwind palette)
 * @example resolveColorTheme('earthy').roles.primary // → a terracotta hex at tone 40
 * @param {string|Object} idOrDefinition
 * @returns {{id: string, name: string, blurb: string, mode: string, seeds: Object, roles: Object, families: (Object|null)}}
 */
function resolveColorTheme(idOrDefinition) {
    const def = typeof idOrDefinition === 'string' ? getColorThemeDefinition(idOrDefinition) : idOrDefinition;
    const mode = def.mode === 'dark' ? 'dark' : 'light';
    const tones = { ...TAILWIND_SHADE_TONES[mode], ...(def.shadeTones || {}) };
    const roleTones = { ...M3_ROLE_TONES[mode], ...(def.roleTones || {}) };
    const roles = { ...buildThemeRoles(def.seeds, roleTones), ...(def.roles || {}) };
    const families = def.families === null ? null : buildThemeFamilies(def.seeds, tones, def.families);
    return { id: def.id, name: def.name, blurb: def.blurb || '', mode, seeds: def.seeds, roles, families };
}

/**
 * Reads a Tailwind family colour for a resolved theme (Classic falls back to the stock palette).
 *
 * @example themeFamilyHex(resolveColorTheme('classic'), 'sky', 100) // → '#e0f2fe'
 * @example themeFamilyHex(resolveColorTheme('midnight'), 'white')   // → '#000000'
 * @param {Object} resolved
 * @param {string} family e.g. 'slate' or 'white'
 * @param {number} [shade]
 * @returns {string}
 */
function themeFamilyHex(resolved, family, shade) {
    const palette = resolved.families || TAILWIND_DEFAULT_PALETTE;
    const entry = palette[family];
    return typeof entry === 'string' ? entry : entry[shade];
}

/**
 * Builds the CSS custom properties (`r g b` triplets) that `applyColorTheme()` writes onto `<html>`.
 *
 * @example buildThemeCssVariables(resolveColorTheme('classic'))['--md-sys-color-primary'] // → '92 124 51'
 * @example '--tw-slate-500' in buildThemeCssVariables(resolveColorTheme('classic')) // → false (stock palette)
 * @param {Object} resolved
 * @returns {Object<string,string>}
 */
function buildThemeCssVariables(resolved) {
    const vars = {};
    for (const role of Object.keys(resolved.roles)) {
        vars['--md-sys-color-' + kebabCaseRole(role)] = rgbTriplet(resolved.roles[role]);
    }
    if (!resolved.families) return vars;
    for (const family of TAILWIND_THEME_FAMILIES) {
        for (const shade of TAILWIND_SHADES) {
            vars['--tw-' + family + '-' + shade] = rgbTriplet(resolved.families[family][shade]);
        }
    }
    vars['--tw-white'] = rgbTriplet(resolved.families.white);
    return vars;
}

/**
 * Removes every previously applied theme variable from an element's inline style.
 *
 * @example removeThemeCssVariables(document.documentElement) // clears --tw-* / --md-sys-color-*
 * @example removeThemeCssVariables({ style: { length: 0 } })  // no-op on an empty style
 * @param {Object} root element with a CSSStyleDeclaration-like `style`
 * @returns {number} how many properties were removed
 */
function removeThemeCssVariables(root) {
    const stale = [];
    for (let i = 0; i < root.style.length; i++) {
        const name = root.style[i];
        if (name && (name.startsWith('--tw-') || name.startsWith('--md-sys-color-'))) stale.push(name);
    }
    stale.forEach((name) => root.style.removeProperty(name));
    return stale.length;
}

/**
 * Applies a theme to the document: swaps the CSS variables, sets `color-scheme` and the
 * `data-theme` / `data-theme-mode` attributes used by the global stylesheet.
 *
 * @example applyColorTheme('midnight').mode // → 'dark' (and <html data-theme="midnight">)
 * @example applyColorTheme('classic', null).id // → 'classic' (no DOM touched)
 * @param {string} id
 * @param {Object} [root=document.documentElement]
 * @returns {Object} the resolved theme
 */
function applyColorTheme(id, root = typeof document === 'undefined' ? null : document.documentElement) {
    const resolved = resolveColorTheme(isKnownColorThemeId(id) ? id : DEFAULT_COLOR_THEME_ID);
    if (!root || !root.style) return resolved;
    removeThemeCssVariables(root);
    const vars = buildThemeCssVariables(resolved);
    Object.keys(vars).forEach((name) => root.style.setProperty(name, vars[name]));
    root.style.colorScheme = resolved.mode;
    root.setAttribute('data-theme', resolved.id);
    root.setAttribute('data-theme-mode', resolved.mode);
    return resolved;
}

/**
 * Representative colours for a theme preview card (canvas, a male and a female person card, a
 * primary button and body text).
 *
 * @example describeThemeSwatches(resolveColorTheme('classic')).male // → '#e0f2fe' (sky-100)
 * @example describeThemeSwatches(resolveColorTheme('midnight')).canvas // → '#000000'
 * @param {Object} resolved
 * @returns {{canvas: string, panel: string, text: string, primary: string, onPrimary: string, male: string, maleBorder: string, female: string, femaleBorder: string, line: string}}
 */
function describeThemeSwatches(resolved) {
    const { cardFill, cardBorder } = COLOR_THEME_PREVIEW_SHADES;
    return {
        canvas: themeFamilyHex(resolved, 'white'),
        panel: themeFamilyHex(resolved, 'slate', 100),
        text: themeFamilyHex(resolved, 'slate', 800),
        primary: resolved.roles.primary,
        onPrimary: resolved.roles.onPrimary,
        male: themeFamilyHex(resolved, 'sky', cardFill),
        maleBorder: themeFamilyHex(resolved, 'sky', cardBorder),
        female: themeFamilyHex(resolved, 'rose', cardFill),
        femaleBorder: themeFamilyHex(resolved, 'rose', cardBorder),
        line: themeFamilyHex(resolved, 'slate', 300)
    };
}

// ─── Tailwind config script (stamped into index.html and the standalone export) ────

/**
 * Formats one Tailwind colour value that reads a CSS variable with a hard-coded fallback.
 *
 * @example tailwindVarColor('--tw-slate-500', '#64748b') // → "'rgb(var(--tw-slate-500, 100 116 139) / <alpha-value>)'"
 * @example tailwindVarColor('--tw-white', '#fff')         // → "'rgb(var(--tw-white, 255 255 255) / <alpha-value>)'"
 * @param {string} variable
 * @param {string} fallbackHex
 * @returns {string} a single-quoted JS string literal
 */
function tailwindVarColor(variable, fallbackHex) {
    return "'rgb(var(" + variable + ', ' + rgbTriplet(fallbackHex) + ') / <alpha-value>)' + "'";
}

/**
 * Serialises the `colors` section of the stamped Tailwind config: every family/shade plus `white`
 * and every Material role, each pointing at its CSS variable with the Classic colour as fallback.
 *
 * @example buildTailwindColorConfigLines()[0] // → "        slate: { 50: 'rgb(var(--tw-slate-50, 248 250 252) / <alpha-value>)', … },"
 * @example buildTailwindColorConfigLines().some((line) => line.includes("'on-primary':")) // → true
 * @returns {string[]} indented source lines
 */
function buildTailwindColorConfigLines() {
    const classicRoles = resolveColorTheme(DEFAULT_COLOR_THEME_ID).roles;
    const lines = TAILWIND_THEME_FAMILIES.map((family) => {
        const shades = TAILWIND_SHADES.map((shade) => shade + ': ' + tailwindVarColor('--tw-' + family + '-' + shade, TAILWIND_DEFAULT_PALETTE[family][shade]));
        return '        ' + family + ': { ' + shades.join(', ') + ' },';
    });
    lines.push('        white: ' + tailwindVarColor('--tw-white', TAILWIND_DEFAULT_PALETTE.white) + ',');
    for (const role of Object.keys(classicRoles)) {
        const token = kebabCaseRole(role);
        lines.push("        '" + token + "': " + tailwindVarColor('--md-sys-color-' + token, classicRoles[role]) + ',');
    }
    return lines;
}

/**
 * Builds the complete `tailwind.config = {…}` script body (no `<script>` tags) shared by
 * `index.html` and the standalone HTML export.
 *
 * @example buildTailwindThemeConfigScript().startsWith('tailwind.config = {') // → true
 * @example buildTailwindThemeConfigScript().includes("'text-gradient'") // → true (keyframes preserved)
 * @returns {string}
 */
function buildTailwindThemeConfigScript() {
    return [
        'tailwind.config = {',
        '  theme: {',
        '    extend: {',
        '      colors: {',
        ...buildTailwindColorConfigLines(),
        '      },',
        '      keyframes: {',
        "        'text-gradient': {",
        "          '0%': { backgroundPosition: '0% 50%' },",
        "          '50%': { backgroundPosition: '100% 50%' },",
        "          '100%': { backgroundPosition: '0% 50%' },",
        '        }',
        '      },',
        '      animation: {',
        "        'text-gradient': 'text-gradient 3s linear infinite',",
        '      }',
        '    }',
        '  }',
        '};'
    ].join('\n');
}

const TAILWIND_THEME_CONFIG_SCRIPT = buildTailwindThemeConfigScript();
