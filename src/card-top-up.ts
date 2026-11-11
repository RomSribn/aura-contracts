import { z } from 'zod';

/**
 * Card top-up on the web (`AURAD-0023`; BFF `AURAT-0207`, web `AURAT-0208`): a
 * third way into the prepaid USD wallet beside Google Play and the App Store.
 * The person pays on the payment provider's hosted page and comes back; the
 * BFF credits the wallet only on the provider's own word (its webhook, or the
 * BFF asking it), never because the browser returned to `returnPath`.
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
 * Body of `POST /v1/wallet/top-ups/card`. Answers `CardTopUpResponse`, `200`.
 *
 * `paymentId` is the client's id for this attempt and the idempotency key: a
 * repeat with the same id and amount answers the same hosted page while it is
 * still open. A new attempt needs a new id.
 *
 * `amountMinor` is credited exactly — it must be a whole number of dollars
 * inside the rule above, or the answer is 400 `card_top_up_amount_invalid`.
 * The server checks it; nothing here is trusted to be a price.
 *
 * `returnPath` is a path on the site that made the request (its `Origin`
 * must be one of the BFF's web origins), e.g. `/checkout?payment=<id>`. The
 * provider sends the person back to it after paying, and to the same path
 * with `cancelled=1` added when they step back. Anything that is not a plain
 * path — a scheme, `//host`, a backslash — is 400
 * `card_top_up_return_path_invalid`.
 */
export const CardTopUpRequest = z.object({
  paymentId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  returnPath: z.string().min(1).max(512).startsWith('/'),
});
export type CardTopUpRequest = z.infer<typeof CardTopUpRequest>;

export const CardTopUpResponse = z.object({
  /** The provider's hosted payment page. Navigate to it; never embed it. */
  redirectUrl: z.string().url(),
});
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
 * amount, or for an attempt that has finished (paid, declined, cancelled or
 * expired). Start again with a new id.
 */
export const CARD_TOP_UP_PAYMENT_CONFLICT = 'card_top_up_payment_conflict';
