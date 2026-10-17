import { z } from 'zod';
import { Currency } from './money';

/**
 * Prepaid USD wallet (AURAD-0002) — balance plus an append-only ledger behind
 * it. Aligned with the BFF as built by `AURAT-0007`
 * (`aura-bff/src/contracts/wallet.ts`): money crosses the wire as integer
 * minor units (cents), never a float and never a nested money object.
 */
/**
 * The new-client offer (`AURAF-0017`): the first paid session costs `pct`% less.
 * Per-user money state, served beside the balance because the wallet is loaded
 * on sign-in and sits behind the same billing flag as booking.
 *
 * `active` is the server's answer, never derived app-side: it is true until a
 * session has used the offer, and comes back if that session is cancelled with
 * a full refund. The figures to charge still come from `SessionPricing` — `pct`
 * is for wording, not arithmetic.
 */
export const FirstSessionOffer = z.object({
  active: z.boolean(),
  pct: z.number().int().min(1).max(100),
});
export type FirstSessionOffer = z.infer<typeof FirstSessionOffer>;

export const WalletResponse = z.object({
  balanceMinor: z.number().int(),
  currency: Currency,
  /**
   * Opaque, stable id for this wallet, handed to a store as its
   * `obfuscatedAccountId` and echoed back on the purchase, so the BFF can
   * refuse a purchase token claimed by a different account (AURAD-0010).
   *
   * **Server-minted on purpose.** If the app derived it — from the uid, say —
   * it could derive somebody else's just as easily, and Google forbids sending
   * an identifiable id in that field regardless. Optional because the BFF only
   * starts serving it in `AURAT-0027`; while it is absent, the app treats the
   * store rail as not configured rather than inventing a value.
   */
  purchaseAccountId: z.string().min(1).max(64).optional(),
  /**
   * Optional because builds and BFFs before `v0.21.0` neither send nor read it;
   * absent means no offer to show.
   */
  firstSessionOffer: FirstSessionOffer.optional(),
});
export type WalletResponse = z.infer<typeof WalletResponse>;

/**
 * Body of `POST /v1/wallet/top-ups`. Stub credit until a PSP exists (the BFF
 * refuses it in production); `idempotencyKey` is client-generated, and
 * replaying it must never credit twice.
 */
export const TopUpRequest = z.object({
  /** $10k sanity cap on a single stub credit; real limits arrive with the PSP. */
  amountMinor: z
    .number()
    .int('amountMinor must be an integer amount of cents')
    .positive('amountMinor must be positive')
    .max(1_000_000, 'amountMinor must not exceed 1000000 (USD 10k)'),
  idempotencyKey: z.string().uuid(),
});
export type TopUpRequest = z.infer<typeof TopUpRequest>;

export const TopUpResponse = z.object({
  /** Id of the append-only ledger entry the credit created. */
  entryId: z.string(),
  balanceMinor: z.number().int(),
  currency: Currency,
});
export type TopUpResponse = z.infer<typeof TopUpResponse>;

/**
 * Body of `POST /v1/wallet/top-ups/google` — the Google Play rail (AURAD-0010).
 *
 * Everything here is a **claim**, not an authority: the caller is already known
 * from the Firebase ID token, and the credit amount is read from the BFF's own
 * tier table keyed by `productId`. Deliberately no amount field — a client that
 * could name its own credit would be a client that mints balance.
 *
 * Deliberately no package name either: the BFF asks Google about *its own*
 * package, so a token belonging to another one simply is not found. Sending it
 * would add a field that can only fail, never protect.
 */
export const GooglePlayTopUpRequest = z.object({
  /** Play's purchase token. Also the idempotency key: one token, one entry. */
  purchaseToken: z.string().min(1),
  /**
   * SKU, e.g. `aura.topup.usd25`. The BFF maps it to the credit and verifies it
   * with Google, so naming the wrong one fails the lookup rather than paying out.
   */
  productId: z.string().min(1),
});
export type GooglePlayTopUpRequest = z.infer<typeof GooglePlayTopUpRequest>;

export const GooglePlayTopUpResponse = z.object({
  /** Ledger entry for this token — the original one on a replay. */
  entryId: z.string(),
  balanceMinor: z.number().int(),
  currency: Currency,
  /** What the SKU credited, so the app never re-derives it from a price. */
  creditedMinor: z.number().int().nonnegative(),
  /**
   * True when this token had already been redeemed. Not an error: it is the
   * expected answer when the app retries a redeem whose response was lost, or
   * re-offers a purchase left un-consumed by a crash. Nothing was credited
   * twice.
   */
  replayed: z.boolean(),
});
export type GooglePlayTopUpResponse = z.infer<typeof GooglePlayTopUpResponse>;

/**
 * Body of `POST /v1/wallet/top-ups/apple` — the StoreKit rail (AURAD-0017).
 *
 * The same claim as the Play rail and for the same reasons: no amount (the BFF
 * reads the credit from its own tier table keyed by `productId`), no bundle id
 * (the BFF asks Apple about its own app).
 *
 * Deliberately no signed transaction either. StoreKit 2 hands the app a JWS,
 * and posting it would be tempting, but a signature only proves the payload was
 * signed — not that the purchase still stands, was not refunded a minute ago,
 * or belongs to this account. The BFF asks the App Store Server API by id
 * instead, exactly as the Play rail asks Google by token.
 */
export const AppleTopUpRequest = z.object({
  /**
   * StoreKit's transaction id. Also the idempotency key: one transaction, one
   * entry.
   */
  transactionId: z.string().min(1),
  /**
   * Product id, e.g. `aura.topup.usd25` — shared with Play, so one tier table
   * serves both rails. The BFF checks it against what Apple reports, so naming
   * the wrong one fails rather than paying out.
   */
  productId: z.string().min(1),
});
export type AppleTopUpRequest = z.infer<typeof AppleTopUpRequest>;

/**
 * Same shape as `GooglePlayTopUpResponse`, kept under its own name so either
 * rail can grow a field without the other inheriting it. `replayed` is true
 * when this `transactionId` had already been redeemed.
 */
export const AppleTopUpResponse = GooglePlayTopUpResponse;
export type AppleTopUpResponse = z.infer<typeof AppleTopUpResponse>;
