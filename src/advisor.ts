import { z } from 'zod';

/**
 * The app's advisor slug, and the only advisor shape that crosses the
 * boundary: the BFF has no advisor catalog endpoint (personas are app-side
 * data per AURAD-0001; the BFF's `advisors` table holds prices only), so a
 * persona DTO here would be a shape nothing sends and nothing reads.
 */
export const AdvisorId = z.string().min(1);
export type AdvisorId = z.infer<typeof AdvisorId>;
