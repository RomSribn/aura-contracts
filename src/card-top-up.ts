import { z } from 'zod';

/**
 * Card top-up on the web (`AURAD-0023`; BFF `AURAT-0207`, web `AURAT-0208`): a
 * third way into the prepaid USD wallet beside Google Play and the App Store.
 * The person pays on the payment provider's hosted page (`hosted`), in the
 * provider's form mounted inside our own page (`embedded`, v0.33.0, BFF
 * `AURAT-0211`), or in our own sheet built from the provider's elements
 * (`elements`, v0.34.0, BFF `AURAT-0213`, web `AURAT-0212`). Either way the BFF
 * credits the wallet only on the provider's own word (its webhook, or the BFF
 * asking it), never because the browser returned to `returnPath` or the form
 * said "done".
 *
 * The provider is not named on the wire, the way the app never learns that
 * Chatwoot exists: these shapes say "card", the BFF knows it is Stripe.
 */

/**
 * The amount rule, one for the web and the BFF (owner, `AURAT-0207` decision
 * 1): whole dollars from `CARD_TOP_UP_MIN_USD` to `CARD_TOP_UP_MAX_USD`. The
 * provider charges a fixed part on every payment, so a $1 top-up would lose
 * about a third to fees; a shortfall under the minimum is topped up by the
 * minimum and the rest stays on the balance. The ceiling is the store ladder's.
 */
export const CARD_TOP_UP_MIN_USD = 5;
export const CARD_TOP_UP_MAX_USD = 120;

/**
 * How the payment page is shown (v0.33.0 and v0.34.0, `AURAD-0023` amendments
 * 2026-11-11 and 2026-11-12):
 *
 * - `hosted` — the person is sent to the provider's own page and comes back
 *   to `returnPath` (or to it with `cancelled=1`);
 * - `embedded` — the provider's form is mounted inside our page with the
 *   `clientSecret` and `publicKey` of the answer. Cards and wallets finish in
 *   place; a bank method (iDEAL, Bancontact) leaves for the bank and comes
 *   back to `returnPath`. There is no "back" link: when the person closes the
 *   form, the client calls `POST …/:paymentId/cancel`;
 * - `elements` (v0.34.0) — the same attempt, but the client draws the sheet
 *   itself from the provider's elements, initialised with the answer's
 *   `clientSecret` and `publicKey`: the wallet buttons, the card step, and —
 *   **required**, because the price is converted to the buyer's currency —
 *   the currency selector (the client must allow that conversion when it
 *   initialises). When the attempt asks for consent to our Terms, the client
 *   shows the provider's terms element; when the account has no email, the
 *   client collects one, since a card payment cannot finish without it. The
 *   client confirms so that only a redirect-based method (a bank) leaves the
 *   page, for `returnPath`. Closing the sheet — or moving to another amount,
 *   which is a new attempt with a new `paymentId` — is `POST
 *   …/:paymentId/cancel` for the old one.
 */
export const CardCheckoutUi = z.enum(['hosted', 'embedded', 'elements']);
export type CardCheckoutUi = z.infer<typeof CardCheckoutUi>;

/**
 * Body of `POST /v1/wallet/top-ups/card`. Answers `CardTopUpResponse`, `200`.
 *
 * `paymentId` is the client's id for this attempt and the idempotency key: a
 * repeat with the same id, amount and `ui` answers the same page (or the same
 * form) while it is still open. A new attempt needs a new id.
 *
 * `amountMinor` is credited exactly — it must be a whole number of dollars
 * inside the rule above, or the answer is 400 `card_top_up_amount_invalid`.
 * The server checks it; nothing here is trusted to be a price.
 *
 * `returnPath` is a path on the site that made the request (its `Origin`
 * must be one of the BFF's web origins), e.g. `/checkout?payment=<id>`. The
 * provider sends the person back to it after paying, and — `hosted` only —
 * to the same path with `cancelled=1` added when they step back. Anything
 * that is not a plain path — a scheme, `//host`, a backslash — is 400
 * `card_top_up_return_path_invalid`.
 *
 * `ui` picks how the page is shown; left out, it is `hosted` (the v0.32.0
 * behaviour).
 */
export const CardTopUpRequest = z.object({
  paymentId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  returnPath: z.string().min(1).max(512).startsWith('/'),
  ui: CardCheckoutUi.default('hosted'),
});
export type CardTopUpRequest = z.infer<typeof CardTopUpRequest>;

/**
 * What to do next — by `kind`:
 *
 * - `redirect` — navigate to `redirectUrl`, never embed it. With `ui:
 *   'hosted'` it is the provider's page. In **any** mode it can also be our
 *   own `returnPath`: the person has already paid and the payment is waiting
 *   to be confirmed — show its status, do not start a new attempt;
 * - `embedded` (`ui: 'embedded'` or `ui: 'elements'`) — mount the provider's
 *   form (`embedded`) or build the sheet from its elements (`elements`) with
 *   `clientSecret`, initialised with `publicKey`. A repeat of the same
 *   `paymentId` while the attempt is open answers the same `clientSecret`.
 *   `clientSecret` lets anyone holding it pay this attempt: keep it in memory,
 *   never in a URL, storage or a log.
 */
export const CardTopUpResponse = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('redirect'),
    redirectUrl: z.string().url(),
  }),
  z.object({
    kind: z.literal('embedded'),
    clientSecret: z.string().min(1),
    /** The provider's public (publishable) key — not a secret. */
    publicKey: z.string().min(1),
  }),
]);
export type CardTopUpResponse = z.infer<typeof CardTopUpResponse>;

/**
 * Where a card top-up stands — the same four values as the web's
 * `TopUpStatus`:
 *
 * - `pending` — not settled yet (still on the provider's page, or a bank
 *   method that confirms later); ask again;
 * - `credited` — the money is on the balance;
 * - `declined` — the provider refused the payment; nothing was charged;
 * - `cancelled` — the person stepped back, or the page expired unpaid.
 */
export const CardTopUpStatus = z.enum(['pending', 'credited', 'declined', 'cancelled']);
export type CardTopUpStatus = z.infer<typeof CardTopUpStatus>;

/**
 * Answer of `GET /v1/wallet/top-ups/card/:paymentId` and of
 * `POST /v1/wallet/top-ups/card/:paymentId/cancel`. Another account's id, or
 * one the server never saw, is `404`.
 *
 * `cancel` closes a page that is still open and answers `cancelled` — unless
 * the person managed to pay in the meantime, in which case it answers what
 * the payment is (`credited` or `pending`). It is safe to call on any status.
 */
export const CardTopUpStatusResponse = z.object({
  paymentId: z.string().uuid(),
  status: CardTopUpStatus,
  /** What this top-up credits (or credited) to the wallet, in USD cents. */
  amountMinor: z.number().int().positive(),
  /** The wallet balance now, so the client can refresh it without asking. */
  balanceMinor: z.number().int(),
});
export type CardTopUpStatusResponse = z.infer<typeof CardTopUpStatusResponse>;

/** 400: the amount is not whole dollars inside `CARD_TOP_UP_MIN_USD…MAX_USD`. */
export const CARD_TOP_UP_AMOUNT_INVALID = 'card_top_up_amount_invalid';
/** 400: `returnPath` is not a plain path, or the request came from no web origin. */
export const CARD_TOP_UP_RETURN_PATH_INVALID = 'card_top_up_return_path_invalid';
/**
 * 409: this `paymentId` is already used — by another account, with another
 * amount, with another `ui`, or for an attempt that has finished (paid,
 * declined, cancelled or expired). Start again with a new id.
 */
export const CARD_TOP_UP_PAYMENT_CONFLICT = 'card_top_up_payment_conflict';
/**
 * 429: this account started too many new attempts in a short while (a new
 * `paymentId` each). The `Retry-After` header says in how many seconds a new
 * one is accepted. A repeat of an attempt already started — the same
 * `paymentId` — is never refused for this.
 */
export const CARD_TOP_UP_TOO_MANY_STARTS = 'card_top_up_too_many_starts';
