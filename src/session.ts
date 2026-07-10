import { z } from 'zod';
import { AdvisorId } from './advisor';

/**
 * Paid fixed-minute session (AURAD-0002): a block of prepaid minutes consumed
 * inside the advisor thread, **non-refundable once started**.
 *
 * v0 shape — `AURAT-0008` owns the final contract. Behind `billing_enabled`.
 */
export const SessionStatus = z.enum(['active', 'finished']);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const PaidSession = z.object({
  id: z.string(),
  advisorId: AdvisorId,
  minutes: z.number().int().positive(),
  status: SessionStatus,
  startedAt: z.string().datetime(),
  /** When the prepaid block runs out. */
  endsAt: z.string().datetime(),
});
export type PaidSession = z.infer<typeof PaidSession>;
