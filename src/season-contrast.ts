import { HexColor, SeasonPalette, type SeasonToken } from './app-config';

/**
 * The contrast rule a season's palette must pass before it can be switched on
 * (`AURAD-0022`, pairs P1–P18 of the `AURAT-0150` design brief, P19–P20 added
 * by the owner for the ticket body). Logic in a package of shapes, on purpose:
 * the backoffice refuses a palette by this function, and the app and the web
 * can re-check with the very same one.
 *
 * WCAG 2.x relative luminance and contrast ratio. A ratio is compared as
 * computed — never rounded up to reach a threshold.
 */

/** One side of a pair: a palette token, or a fixed colour of the design. */
export type ContrastColour =
  | { token: SeasonToken }
  /** `alpha` < 1 is composited over the pair's background first. */
  | { hex: string; alpha?: number; name: string };

export interface SeasonContrastPair {
  id: string;
  foreground: ContrastColour;
  background: ContrastColour;
  min: 4.5 | 3;
  /** Where the pair is on screen, for people reading a failed check. */
  where: string;
}

const CARD = { hex: '#FFFFFF', name: 'card #FFFFFF' } as const;
const TAB_BAR = { hex: '#F4EFE5', name: 'tab bar #F4EFE5' } as const;
const WHITE = { hex: '#FFFFFF', name: '#FFFFFF' } as const;
const WHITE_70 = { hex: '#FFFFFF', alpha: 0.7, name: '#FFFFFF@0.70' } as const;
const INK = { hex: '#221F1A', name: 'ink #221F1A' } as const;
const TEAL_INK = { hex: '#1E726B', name: 'teal-ink #1E726B' } as const;

const t = (token: SeasonToken): ContrastColour => ({ token });

/**
 * P1–P18, as the brief lists them, and P19–P20 (owner, 2026-10-31,
 * `AURAT-0149-006`): the ticket's title in ink and its teal "Auto-applied" /
 * "You save" on the ticket body. A gradient ground is checked against both
 * ends; the body runs `ticketSoft → card`, and ink (16.42) and teal-ink (5.72)
 * on card `#FFFFFF` pass whatever the palette, so only `ticketSoft` is a pair.
 * `orbBase`, `orbSoft` and `effectTint` sit in no pair: required in a palette,
 * but nothing is read on them.
 */
export const SEASON_CONTRAST_PAIRS: readonly SeasonContrastPair[] = [
  { id: 'P1', foreground: t('heroTitle'), background: t('heroFrom'), min: 4.5, where: 'hero title' },
  { id: 'P2', foreground: t('heroTitle'), background: t('heroTo'), min: 4.5, where: 'hero title' },
  { id: 'P3', foreground: t('heroBody'), background: t('heroFrom'), min: 4.5, where: 'hero body' },
  { id: 'P4', foreground: t('heroBody'), background: t('heroTo'), min: 4.5, where: 'hero body' },
  { id: 'P5', foreground: t('heroCtaLabel'), background: t('heroCta'), min: 4.5, where: 'hero button text' },
  { id: 'P6', foreground: t('heroCta'), background: t('heroFrom'), min: 3, where: 'hero button edge' },
  { id: 'P7', foreground: t('heroCta'), background: t('heroTo'), min: 3, where: 'hero button edge' },
  { id: 'P8', foreground: t('ticketStubLabel'), background: t('ticketStub'), min: 4.5, where: 'ticket stub label' },
  { id: 'P9', foreground: t('ticketEyebrow'), background: t('ticketSoft'), min: 4.5, where: 'ticket eyebrow' },
  { id: 'P10', foreground: t('ticketEyebrow'), background: CARD, min: 4.5, where: 'ticket eyebrow on card' },
  { id: 'P11', foreground: WHITE, background: t('bannerFrom'), min: 4.5, where: 'banner title' },
  { id: 'P12', foreground: WHITE, background: t('bannerTo'), min: 4.5, where: 'banner title' },
  { id: 'P13', foreground: WHITE_70, background: t('bannerFrom'), min: 4.5, where: 'banner subtitle' },
  { id: 'P14', foreground: WHITE_70, background: t('bannerTo'), min: 4.5, where: 'banner subtitle' },
  { id: 'P15', foreground: t('bannerAccent'), background: t('bannerFrom'), min: 4.5, where: 'banner accent' },
  { id: 'P16', foreground: t('bannerAccent'), background: t('bannerTo'), min: 4.5, where: 'banner accent' },
  { id: 'P17', foreground: t('tabActive'), background: TAB_BAR, min: 4.5, where: 'app tab bar' },
  { id: 'P18', foreground: t('tabActive'), background: CARD, min: 4.5, where: 'web nav item on card' },
  { id: 'P19', foreground: INK, background: t('ticketSoft'), min: 4.5, where: 'ticket title on its body' },
  { id: 'P20', foreground: TEAL_INK, background: t('ticketSoft'), min: 4.5, where: 'ticket "Auto-applied" / "You save"' },
];

const isHex = (value: string): boolean => HexColor.safeParse(value).success;

function channels(hex: string): [number, number, number] {
  if (!isHex(hex)) {
    throw new Error(`not a #RRGGBB colour: ${hex}`);
  }
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number];
}

function toHex(rgb: readonly number[]): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** `foreground` at `alpha` over an opaque `background`, as a screen draws it. */
function compositeOver(foreground: string, alpha: number, background: string): string {
  const fg = channels(foreground);
  const bg = channels(background);
  return toHex(fg.map((c, i) => Math.round(alpha * c + (1 - alpha) * bg[i]!)));
}

/** WCAG relative luminance of an opaque `#RRGGBB`, 0 (black) … 1 (white). */
function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two opaque colours, 1 … 21. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface SeasonContrastResult {
  id: string;
  where: string;
  min: 4.5 | 3;
  /** The token's name, or the fixed colour's ("card #FFFFFF") — what a table shows. */
  foregroundName: string;
  backgroundName: string;
  /** Resolved colours; `null` where the palette does not have the token yet. */
  foreground: string | null;
  background: string | null;
  /** `null` while either side is missing. */
  ratio: number | null;
  ok: boolean;
}

function resolve(
  colour: ContrastColour,
  palette: Partial<Record<SeasonToken, string>>,
): string | null {
  if ('token' in colour) {
    const value = palette[colour.token];
    return value !== undefined && isHex(value) ? value.toUpperCase() : null;
  }
  return colour.hex;
}

/**
 * Every pair of `SEASON_CONTRAST_PAIRS` against a palette. Takes a partial one
 * so a draft can show where it stands: a pair with a missing or malformed side
 * has no ratio and does not pass. A palette passes when every result is `ok`.
 */
export function checkSeasonPalette(
  palette: Partial<Record<SeasonToken, string>>,
): SeasonContrastResult[] {
  return SEASON_CONTRAST_PAIRS.map((pair) => {
    const background = resolve(pair.background, palette);
    const rawForeground = resolve(pair.foreground, palette);
    const alpha = 'token' in pair.foreground ? undefined : pair.foreground.alpha;
    const foreground =
      rawForeground !== null && background !== null && alpha !== undefined && alpha < 1
        ? compositeOver(rawForeground, alpha, background)
        : rawForeground;
    const ratio =
      foreground !== null && background !== null ? contrastRatio(foreground, background) : null;
    return {
      id: pair.id,
      where: pair.where,
      min: pair.min,
      foregroundName: nameOf(pair.foreground),
      backgroundName: nameOf(pair.background),
      foreground,
      background,
      ratio,
      ok: ratio !== null && ratio >= pair.min,
    };
  });
}

const nameOf = (colour: ContrastColour): string => ('token' in colour ? colour.token : colour.name);

/**
 * Whether a palette may go live: a whole `SeasonPalette` — all seventeen
 * tokens, `orbBase`, `orbSoft` and `effectTint` included, though no pair reads
 * them — and every pair passing.
 */
export function seasonPalettePasses(palette: Partial<Record<SeasonToken, string>>): boolean {
  return (
    SeasonPalette.safeParse(palette).success &&
    checkSeasonPalette(palette).every((result) => result.ok)
  );
}
