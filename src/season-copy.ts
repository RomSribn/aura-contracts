import { z } from 'zod';

// The season's texts (`AURAF-0022`, `AURAT-0147`, `SEASONAL.md` §1, §2, §11):
// which there are, how long each may be, which placeholders each may use, and
// how a client fills them. Pure, and shared on purpose: the backoffice measures
// a text with `fillSeasonCopy`, and the clients fill it with the same function,
// so what the server accepted is what fits on screen.

/**
 * The season's words (`SEASONAL.md` §1, §2, §11), English. Every key is sent;
 * which one shows is the client's call — `heroBody` with a code on show,
 * `heroBodyNoCode` without, the ticket's code or discount texts by the
 * one-ticket rule.
 */
export const SEASON_COPY_KEYS = [
  'heroTitle',
  'heroBody',
  'heroBodyNoCode',
  'cta',
  'ticketCodeEyebrow',
  'ticketCodeTitle',
  'ticketDiscountEyebrow',
  'ticketDiscountTitle',
  'ticketDiscountSub',
] as const;
export type SeasonCopyKey = (typeof SEASON_COPY_KEYS)[number];

/**
 * Character limits, as `SEASONAL.md` §1 and §2 guarantee them at 316 pt of
 * content. Counted **after** the placeholders are filled (`fillSeasonCopy`).
 */
export const SEASON_COPY_LIMITS = {
  heroTitle: 26,
  heroBody: 50,
  heroBodyNoCode: 50,
  cta: 16,
  ticketCodeEyebrow: 22,
  ticketCodeTitle: 22,
  ticketDiscountEyebrow: 22,
  ticketDiscountTitle: 22,
  ticketDiscountSub: 36,
} as const satisfies Record<SeasonCopyKey, number>;

/** `{code}` the live public code, `{amount}` its credit, `{pct}` the discount. */
export const SEASON_PLACEHOLDERS = ['code', 'amount', 'pct'] as const;
export type SeasonPlaceholder = (typeof SEASON_PLACEHOLDERS)[number];

/**
 * Which placeholders a text may use: only those that always have a value where
 * the client shows it. The code texts show only with a code on show, the
 * discount texts only with a discount; the rest show either way.
 */
export const SEASON_COPY_PLACEHOLDERS = {
  heroTitle: [],
  heroBody: ['code', 'amount'],
  heroBodyNoCode: [],
  cta: ['code', 'amount'],
  ticketCodeEyebrow: ['code', 'amount'],
  ticketCodeTitle: ['code', 'amount'],
  ticketDiscountEyebrow: ['pct'],
  ticketDiscountTitle: ['pct'],
  ticketDiscountSub: ['pct'],
} as const satisfies Record<SeasonCopyKey, readonly SeasonPlaceholder[]>;

/** Cents as a season text shows them: `$5`, `$5.50`. */
export function formatSeasonAmount(amountMinor: number): string {
  const dollars = Math.floor(amountMinor / 100);
  const cents = amountMinor % 100;
  return cents === 0 ? `$${dollars}` : `$${dollars}.${String(cents).padStart(2, '0')}`;
}

/**
 * A season text as shown: `{code}`, `{amount}` and `{pct}` filled. The server
 * measures lengths with this very function, so what it accepted fits.
 */
export function fillSeasonCopy(
  template: string,
  values: { code?: string; amountMinor?: number; pct?: number },
): string {
  return template
    .split('{code}')
    .join(values.code ?? '{code}')
    .split('{amount}')
    .join(values.amountMinor === undefined ? '{amount}' : formatSeasonAmount(values.amountMinor))
    .split('{pct}')
    .join(values.pct === undefined ? '{pct}' : String(values.pct));
}

/** The placeholders a text uses, known or not (`{name}` of letters). */
export function seasonPlaceholdersIn(template: string): string[] {
  return [...template.matchAll(/\{([A-Za-z]+)\}/g)].map((match) => match[1] ?? '');
}

export const SeasonCopy = z.object(
  Object.fromEntries(SEASON_COPY_KEYS.map((key) => [key, z.string().min(1)])) as Record<
    SeasonCopyKey,
    z.ZodString
  >,
);
export type SeasonCopy = z.infer<typeof SeasonCopy>;

