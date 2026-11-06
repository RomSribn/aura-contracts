import { z } from 'zod';

import { SeasonCopy } from './season-copy';

/**
 * `GET /v1/app-config` (`AURAF-0022`, BFF `AURAT-0147`; app `AURAT-0148`, web
 * `AURAT-0149`): what the operator has switched on right now, read before the
 * first screen — the season's look, the public code on show, the session
 * discount on show. Public (no token), the same answer for everyone, cached by
 * the server for a minute (`Cache-Control`, `ETag` → `304`).
 *
 * Only what is in effect **now**. Every part carries its `endsAt`, so a client
 * holding a cached copy switches it off on time without asking again.
 *
 * Built to survive what a released client has never heard of: `preset` and
 * `effect` are strings rather than enums, and a palette token added later
 * arrives as an optional field an older client simply drops. An unknown preset
 * id changes nothing — the season is drawn from its palette; an unknown effect
 * means no effect.
 */

/** `#RRGGBB` as a pattern, for schemas written outside Zod (OpenAPI). */
export const HEX_COLOR_PATTERN = '^#[0-9A-Fa-f]{6}$';

/** `#RRGGBB`, the only colour form a season carries. */
export const HexColor = z.string().regex(new RegExp(HEX_COLOR_PATTERN), 'must be #RRGGBB');
export type HexColor = z.infer<typeof HexColor>;

/**
 * The only colours a season may set (`AURAT-0150` design brief, "TOKEN
 * WHITELIST"). Everything else — paper, card, ink, prices, the whole teal
 * family — never changes with a season.
 */
export const SEASON_TOKENS = [
  'heroFrom',
  'heroTo',
  'heroTitle',
  'heroBody',
  'heroCta',
  'heroCtaLabel',
  'ticketStub',
  'ticketStubLabel',
  'ticketSoft',
  'ticketEyebrow',
  'orbBase',
  'orbSoft',
  'bannerFrom',
  'bannerTo',
  'bannerAccent',
  'tabActive',
  'effectTint',
] as const;
export type SeasonToken = (typeof SEASON_TOKENS)[number];

/**
 * A season's full palette: all seventeen tokens, no defaults. The server only
 * ever sends one that passed every contrast pair of `SEASON_CONTRAST_PAIRS` (P1–P20)
 * (see `season-contrast`).
 */
export const SeasonPalette = z.object({
  /** Home hero ground, gradient start. */
  heroFrom: HexColor,
  /** Home hero ground, gradient end. */
  heroTo: HexColor,
  heroTitle: HexColor,
  heroBody: HexColor,
  /** Hero button fill. */
  heroCta: HexColor,
  /** Hero button text. */
  heroCtaLabel: HexColor,
  /** Advisors ticket stub fill. */
  ticketStub: HexColor,
  /** Stub label ("SALE" / "CODE"). */
  ticketStubLabel: HexColor,
  /** Ticket body gradient start and the perforation dash. */
  ticketSoft: HexColor,
  ticketEyebrow: HexColor,
  /** Splash orb rim. */
  orbBase: HexColor,
  /** Splash orb highlight. */
  orbSoft: HexColor,
  /** Daily ritual banner gradient start. */
  bannerFrom: HexColor,
  /** Daily ritual banner gradient end. */
  bannerTo: HexColor,
  /** Banner eyebrow, fan outlines, glyphs. */
  bannerAccent: HexColor,
  /** Active tab icon + dot; on the web the active nav item, label included. */
  tabActive: HexColor,
  /** Particles. */
  effectTint: HexColor,
});
export type SeasonPalette = z.infer<typeof SeasonPalette>;

/** Effects a client knows how to draw. The wire carries a plain string. */
export const SEASON_EFFECTS = ['snow', 'leaves', 'hearts'] as const;
export type SeasonEffect = (typeof SEASON_EFFECTS)[number];

export const AppConfigSeason = z.object({
  campaignId: z.string().min(1),
  /** The preset's name ("winter") — a hint and a label, never needed to draw. */
  preset: z.string().min(1),
  endsAt: z.string().datetime({ offset: true }),
  palette: SeasonPalette,
  /** Absolute URLs. A new picture is a new URL — a file is never replaced in place. */
  art: z.object({
    /** Hero illustration, 720×720, transparent. */
    hero: z.string().url().nullable(),
    /** Ticket stub glyph, 192×192, transparent. */
    ticket: z.string().url().nullable(),
  }),
  /** All nine texts, placeholders unfilled — see `SEASON_COPY_PLACEHOLDERS`, `fillSeasonCopy`. */
  copy: SeasonCopy,
  /** One of `SEASON_EFFECTS` today; anything else — draw no effect. */
  effect: z.string().min(1).nullable(),
});
export type AppConfigSeason = z.infer<typeof AppConfigSeason>;

/**
 * A public promo code on show ("Apply WINTER5"). Redeemed through the usual
 * `POST /v1/wallet/promo-codes/redeem`. `endsAt` is the earlier of the
 * campaign's end and the code's own expiry.
 */
export const AppConfigPromo = z.object({
  campaignId: z.string().min(1),
  code: z.string().min(1),
  /** The code's credit, in cents — `{amount}` in the season's texts. */
  amountMinor: z.number().int().positive(),
  headline: z.string().min(1),
  endsAt: z.string().datetime({ offset: true }),
});
export type AppConfigPromo = z.infer<typeof AppConfigPromo>;

/**
 * A session discount on show ("20% OFF · Winter sale"). Display only: the price
 * is the server's (`SessionPricing`), which takes the bigger of this and the
 * first-session offer, never both.
 */
export const AppConfigDiscount = z.object({
  campaignId: z.string().min(1),
  label: z.string().min(1),
  pct: z.number().int().min(1).max(100),
  endsAt: z.string().datetime({ offset: true }),
});
export type AppConfigDiscount = z.infer<typeof AppConfigDiscount>;

/**
 * Languages switched off by the operator (`AURAF-0023`, BFF `AURAT-0168`) — the
 * safety net for a translation that shipped wrong, since there are no
 * over-the-air updates. A client whose chosen or system language is listed
 * shows English. Codes from `LANGUAGES`, never `en`; plain strings rather than
 * `Language`, so a code an older client has never heard of cannot stop it from
 * reading the rest of the config. The server answers a switched-off language in
 * English too, whatever a client still has cached.
 */
export const AppConfigDisabledLanguages = z.array(z.string());
export type AppConfigDisabledLanguages = z.infer<typeof AppConfigDisabledLanguages>;

export const AppConfigResponse = z.object({
  season: AppConfigSeason.nullable(),
  /** Always `null` while billing is off. */
  promo: AppConfigPromo.nullable(),
  /** Always `null` while billing is off. */
  discount: AppConfigDiscount.nullable(),
  /** Empty when nothing is switched off; absent from a `v0.27` server — hence the default. */
  disabledLanguages: AppConfigDisabledLanguages.default([]),
});
export type AppConfigResponse = z.infer<typeof AppConfigResponse>;
