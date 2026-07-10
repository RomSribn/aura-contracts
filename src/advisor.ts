import { z } from 'zod';

export const AdvisorId = z.string().min(1);
export type AdvisorId = z.infer<typeof AdvisorId>;

/**
 * Advisor **persona** as the app renders it (AURAD-0001). The real chatter behind
 * the persona is never exposed. `pricePerMinuteCents` drives paid-session cost
 * (AURAD-0002); `online` is persona-level presence, not an individual agent's.
 */
export const Advisor = z.object({
  id: AdvisorId,
  name: z.string(),
  avatarUrl: z.string().url().nullable(),
  pricePerMinuteCents: z.number().int().nonnegative(),
  online: z.boolean(),
});
export type Advisor = z.infer<typeof Advisor>;
