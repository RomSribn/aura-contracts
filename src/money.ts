import { z } from 'zod';

/** USD only for v1 — the prepaid wallet is USD (AURAD-0002). */
export const Currency = z.literal('USD');
export type Currency = z.infer<typeof Currency>;

/**
 * Money never crosses this boundary as an object or a float: every amount is
 * an integer of **minor units (cents)** carried by the field that owns it
 * (`balanceMinor`, `costMinor`, `priceMinorPerMinute`, `amountMinor`), so
 * balances and the append-only ledger (AURAD-0002) can't drift.
 */
