import { z } from 'zod';
import { Money } from './money';

/**
 * Prepaid USD wallet (AURAD-0002).
 *
 * v0 shape — `AURAT-0007` owns the final contract (balance + append-only ledger).
 * Behind `billing_enabled`.
 */
export const Wallet = z.object({
  balance: Money,
});
export type Wallet = z.infer<typeof Wallet>;
