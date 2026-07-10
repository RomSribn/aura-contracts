import { z } from 'zod';
import { AdvisorId } from './advisor';

/**
 * Direction from the user's point of view. The app maps its per-advisor thread
 * 1:1 to a BFF conversation (AURAD-0003).
 */
export const MessageDirection = z.enum(['user', 'advisor']);
export type MessageDirection = z.infer<typeof MessageDirection>;

/**
 * A chat message. `id` is the BFF's monotonic, orderable id — clients MUST order
 * by it: Chatwoot gives no cross-message ordering guarantee (AURAI-0002 §2.4).
 */
export const Message = z.object({
  id: z.string(),
  advisorId: AdvisorId,
  direction: MessageDirection,
  text: z.string(),
  /** ISO-8601 timestamp. */
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof Message>;

/** Persona-level presence + typing (AURAD-0001). */
export const AdvisorPresence = z.object({
  advisorId: AdvisorId,
  online: z.boolean(),
  typing: z.boolean(),
});
export type AdvisorPresence = z.infer<typeof AdvisorPresence>;

/**
 * Send a message to an advisor. `clientToken` is a client-generated idempotency
 * key so retries don't create duplicates (AURAI-0002 — idempotency at the seams).
 */
export const SendMessageRequest = z.object({
  advisorId: AdvisorId,
  text: z.string().min(1),
  clientToken: z.string().min(1),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequest>;
