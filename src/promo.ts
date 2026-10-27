import { z } from 'zod';
import { Currency } from './money';

/**
 * Promo codes (`AURAF-0021`, BFF half `AURAT-0143`): an operator issues a batch
 * of single-use codes worth a fixed USD credit; a person types one in and the
 * wallet is credited by the server. `POST /v1/wallet/promo-codes/redeem`, behind
 * the same billing flag as the rest of `/v1/wallet` (a `404` with no code means
 * the flag is off).
 *
 * - **`200`** with `RedeemPromoCodeResponse` — credited, or, with
 *   `replayed: true`, this account had already redeemed this code (a response
 *   lost on the way back is safe to retry; nothing is credited twice).
 * - **`409`** with `ApiError.code` from `PromoCodeRefusalCode` — nothing was
 *   credited.
 * - **`429`** with `promo_code_too_many_attempts` and a `Retry-After` header in
 *   seconds.
 *
 * Promo credit is not money the person paid: it has no cash value, is not
 * refundable and not transferable. The server books it as its own ledger type,
 * never as a top-up.
 */

/**
 * Body of `POST /v1/wallet/promo-codes/redeem`.
 *
 * The code travels **in the body only** — a URL is written to the request log
 * whole, a body never is. Deliberately no amount: the credit is the batch's,
 * read from the server's own record.
 */
export const RedeemPromoCodeRequest = z.object({
  /**
   * As the person typed or pasted it. Case, spaces, dashes and invisible
   * characters are the server's to normalise (`K7QM-9XRT`, `k7qm 9xrt` are the
   * same code), so the client checks only that the field is not empty — the
   * format can change without a client release.
   */
  code: z.string().min(1).max(64),
});
export type RedeemPromoCodeRequest = z.infer<typeof RedeemPromoCodeRequest>;

export const RedeemPromoCodeResponse = z.object({
  /** The promo-credit ledger entry — the original one on a replay. */
  entryId: z.string(),
  /** The current balance, after the credit. */
  balanceMinor: z.number().int(),
  currency: Currency,
  /** What the code credited, from the server's record — never re-derived. */
  creditedMinor: z.number().int().positive(),
  /**
   * True when this account had already redeemed this code. Not an error: it is
   * the expected answer to a retry after a lost response. Nothing was credited
   * twice.
   */
  replayed: z.boolean(),
});
export type RedeemPromoCodeResponse = z.infer<typeof RedeemPromoCodeResponse>;

/**
 * Named in `ApiError.code` when a code is refused. Clients word the refusal by
 * this code; `ApiError.message` is English for developers.
 */
export const PromoCodeRefusalCode = z.enum([
  /** HTTP 409. No such code — or not even the shape of one. Counts toward the attempt limit. */
  'promo_code_not_found',
  /** HTTP 409. Redeemed by another account. (By this one, it is a `200` replay.) */
  'promo_code_already_used',
  /** HTTP 409. The batch's validity has ended. */
  'promo_code_expired',
  /** HTTP 409. An operator switched the code, or its whole batch, off. */
  'promo_code_disabled',
  /** HTTP 409. This account has already redeemed a code from the same batch — one per account. */
  'promo_code_campaign_used',
  /**
   * HTTP 429, with `Retry-After` in seconds. Too many unknown codes from this
   * account in the last hour; nothing it sends is checked until the wait is over.
   */
  'promo_code_too_many_attempts',
]);
export type PromoCodeRefusalCode = z.infer<typeof PromoCodeRefusalCode>;
