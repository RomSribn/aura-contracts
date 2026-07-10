import { z } from 'zod';

/** USD only for v1 — the prepaid wallet is USD (AURAD-0002). */
export const Currency = z.literal('USD');
export type Currency = z.infer<typeof Currency>;

/**
 * Money as integer **minor units (cents)** — never a float, so balances and the
 * append-only ledger (AURAD-0002) can't drift.
 */
export const Money = z.object({
  amountCents: z.number().int(),
  currency: Currency,
});
export type Money = z.infer<typeof Money>;
