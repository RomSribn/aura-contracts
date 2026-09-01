import { z } from 'zod';

/**
 * A card's identity in the Rider–Waite standard — `major-19-sun`, `cups-02`,
 * `wands-knight` (`AURAD-0012`).
 *
 * It names the **card**, not the artwork: every tarot deck ever printed has a
 * Sun, so replacing the deck replaces images and leaves these ids alone. That
 * is deliberate and load-bearing — the BFF stores the object key beside the id,
 * so a new deck is new objects and a moved column, never a migration of what a
 * card *is*. It is also already fit to be a translation key when the texts stop
 * being English-only.
 */
export const TarotCardId = z
  .string()
  .regex(/^[a-z0-9-]{1,64}$/, 'tarot card id must be 1-64 chars of [a-z0-9-]');
export type TarotCardId = z.infer<typeof TarotCardId>;

/**
 * A `YYYY-MM-DD` calendar day. Not a timestamp: the day a card belongs to is a
 * label, and turning it back into an instant is exactly the mistake that makes
 * a card change at the wrong hour.
 */
export const LocalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'localDate must be YYYY-MM-DD');
export type LocalDate = z.infer<typeof LocalDate>;

/**
 * One tarot card as the daily draw serves it (`AURAT-0049`).
 *
 * There is no image *key* and no bucket here, for the same reason `Advisor`
 * carries `avatarUrl` and not `avatarKey`: storage is the server's business,
 * and `imageUrl` arrives already composed from per-env config (`AURAD-0012`).
 *
 * `keywords` is one display string of exactly three words joined by ` · ` —
 * the card face renders it as written, so splitting it into an array would
 * hand the client a formatting decision the deck already made.
 */
export const TarotCard = z.object({
  id: TarotCardId,
  /** English name, e.g. "The Sun". */
  name: z.string(),
  /** Three keywords joined by " · ", e.g. "Clarity · Warmth · Vitality". */
  keywords: z.string(),
  /** One or two sentences of guidance for the day. Never a prediction. */
  daily: z.string(),
  imageUrl: z.string().url(),
});
export type TarotCard = z.infer<typeof TarotCard>;

/**
 * Query of `GET /v1/tarot/daily`.
 *
 * `tz` is the **device's** IANA zone, and it is the whole of what the client
 * gets to say about time. The server reads its own clock in that zone to decide
 * which day "today" is.
 *
 * The client deliberately cannot send the date. A card is chosen *by* the day,
 * so a client-named day is a client that can re-roll its card — the exact hole
 * `AURAT-0048` closed. A zone is not that handle: it moves the boundary by at
 * most a day, and the server's `(user, localDate)` record refuses to deal the
 * same day twice regardless.
 *
 * Omitting it is not an error — the server falls back to UTC, which puts the
 * boundary in the wrong place for most of the world but still answers with a
 * card. An unknown zone is treated the same way, not as a 400.
 */
export const DailyCardQuery = z.object({
  tz: z.string().optional(),
});
export type DailyCardQuery = z.infer<typeof DailyCardQuery>;

/**
 * Response of `GET /v1/tarot/daily` — the card this user was dealt for this
 * day, dealt on the first read and unchanged by every read after it.
 *
 * `localDate` is what the server decided "today" is, echoed back so the client
 * can tell a new day from a re-read without owning the decision. `drawn` says
 * whether the reveal ritual has already been played through: it is what makes
 * a returning user see their card face-up rather than replay the animation.
 */
export const DailyCardResponse = z.object({
  card: TarotCard,
  localDate: LocalDate,
  drawn: z.boolean(),
});
export type DailyCardResponse = z.infer<typeof DailyCardResponse>;

/**
 * Body of `POST /v1/tarot/daily/drawn` — the reveal ritual finished.
 *
 * Idempotent: the second call for the same day changes nothing and the first
 * `drawnAt` stands. It carries `tz` for one reason only — the day it marks has
 * to be resolved the same way `GET` resolved it.
 */
export const MarkDailyCardDrawnRequest = z.object({
  tz: z.string().optional(),
});
export type MarkDailyCardDrawnRequest = z.infer<typeof MarkDailyCardDrawnRequest>;

// --- The spread a chatter lays out in the thread (AURAF-0012) ---

/**
 * How many backs the fan shows. Seven — a **fan**, not the deck: a tap names a
 * position among these, never a card out of 78, so this is what bounds
 * `position` and what the app lays out.
 *
 * Published rather than kept server-side because both halves have to agree on
 * it: the app draws exactly this many backs, and the server refuses a position
 * outside them.
 */
export const TAROT_SPREAD_POSITIONS = 7;

/**
 * A position in the fan, **on the way in** — the body of the pick call.
 *
 * Strict here and loose in every response below, which is the asymmetry v0.8.2
 * settled: a value arriving from a device is checked before it reaches the
 * database; a value we recorded ourselves is not re-checked on the way out. If
 * the fan ever grows, an old stored `6` must not become a message a client
 * refuses to parse.
 */
export const TarotSpreadPosition = z
  .number()
  .int()
  .min(0)
  .max(TAROT_SPREAD_POSITIONS - 1, `position must be 0-${TAROT_SPREAD_POSITIONS - 1}`);
export type TarotSpreadPosition = z.infer<typeof TarotSpreadPosition>;

/** What was chosen, and when. `at` is ISO-8601, the server's record of the tap. */
export const TarotSpreadPick = z.object({
  position: z.number().int(),
  at: z.string(),
});
export type TarotSpreadPick = z.infer<typeof TarotSpreadPick>;

/**
 * The state of one spread, carried on the message that laid it out.
 *
 * A union of exactly two members rather than one object with nullable fields,
 * and that is the load-bearing part: **the card of an unpicked spread does not
 * exist in this type**, so no client can render it and no server can publish it
 * by accident. That is deliberate (`AURAF-0012-001`) — the card is decided by
 * the chatter in advance, and sending it with the fan would put the outcome in
 * the device's memory before the person touched the screen; anyone watching the
 * traffic would see the answer before the question. The card arrives as the
 * **answer to the pick**, from `POST /v1/tarot/spread/{messageId}/pick`.
 *
 * `picked` is the discriminant: `spread.picked === null` narrows to the open
 * fan, and the truthy branch has the card.
 */
export const TarotSpread = z.union([
  z.object({ picked: z.null() }),
  z.object({ picked: TarotSpreadPick, card: TarotCard }),
]);
export type TarotSpread = z.infer<typeof TarotSpread>;

/**
 * Body of `POST /v1/tarot/spread/{messageId}/pick` — the position the finger
 * landed on.
 */
export const PickSpreadCardRequest = z.object({
  position: TarotSpreadPosition,
});
export type PickSpreadCardRequest = z.infer<typeof PickSpreadCardRequest>;

/**
 * Response of the pick — and the only place the card of a spread is ever
 * served.
 *
 * Idempotent, and 200 on the repeat: a second tap (a double tap, a retry on a
 * bad connection) is answered with the pick that was already recorded, the
 * *first* position and the *first* timestamp, not an error. A spread that is
 * not this caller's, or not a spread at all, is a 404 — never a 403, which
 * would confirm that the id names something.
 */
export const PickSpreadCardResponse = z.object({
  card: TarotCard,
  position: z.number().int(),
  pickedAt: z.string(),
});
export type PickSpreadCardResponse = z.infer<typeof PickSpreadCardResponse>;
