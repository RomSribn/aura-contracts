import { z } from 'zod';

/**
 * Standard error body the BFF returns. The app only ever sees *our* errors — a
 * Chatwoot failure is never surfaced raw to the device (AURAI-0002).
 */
export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiError>;
