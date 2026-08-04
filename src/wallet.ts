import { z } from 'zod';
import { Currency } from './money';

/**
 * Prepaid USD wallet (AURAD-0002) — balance plus an append-only ledger behind
 * it. Aligned with the BFF as built by `AURAT-0007`
 * (`aura-bff/src/contracts/wallet.ts`): money crosses the wire as integer
 * minor units (cents), never a float and never a nested money object.
 */
export const WalletResponse = z.object({
  balanceMinor: z.number().int(),
  currency: Currency,
});
export type WalletResponse = z.infer<typeof WalletResponse>;

/**
 * Body of `POST /v1/wallet/top-ups`. Stub credit until a PSP exists (the BFF
 * refuses it in production); `idempotencyKey` is client-generated, and
 * replaying it must never credit twice.
 */
export const TopUpRequest = z.object({
  /** $10k sanity cap on a single stub credit; real limits arrive with the PSP. */
  amountMinor: z.number().int().positive().max(1_000_000),
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
