import { z } from 'zod';
import { AdvisorId } from './advisor';

/**
 * Chat contract — mirrors the BFF as built by AURAT-0005 (aura-bff
 * `src/contracts/message.ts` is the runtime ground truth until the BFF
 * migrates onto this package).
 *
 * Direction is from the user's point of view. The app maps its per-advisor
 * thread 1:1 to a BFF conversation (AURAD-0003).
 */
export const MessageDirection = z.enum(['user', 'advisor']);
export type MessageDirection = z.infer<typeof MessageDirection>;

/**
 * A chat message. `id` is the BFF's own orderable id — Chatwoot message ids
 * never leave the BFF; history pages arrive already sorted ascending.
 * `createdAt` is ISO-8601 (the agent desk's authoritative send time).
 * No sender identity ever crosses this boundary (AURAD-0001).
 */
export const Message = z.object({
  id: z.string(),
  advisorId: AdvisorId,
  direction: MessageDirection,
  content: z.string(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof Message>;

/** Body of `POST /v1/advisors/:advisorId/messages`. */
export const SendMessageRequest = z.object({
  content: z.string().trim().min(1).max(4000),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequest>;

/**
 * Query of `GET /v1/advisors/:advisorId/messages`. Cursors are message ids
 * from previous pages: `after` = delta sync since the newest stored message
 * (app resume), `before` = scroll-back from the oldest visible one. No
 * cursor = the newest page. Pages are always ascending.
 */
export const HistoryQuery = z.object({
  after: z.string().optional(),
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type HistoryQuery = z.infer<typeof HistoryQuery>;

export const HistoryResponse = z.object({
  messages: z.array(Message),
});
export type HistoryResponse = z.infer<typeof HistoryResponse>;

/**
 * Server → app WebSocket events (`/ws?token=<Firebase ID token>`).
 * `message.new` ships today (AURAT-0005); `presence.update` and
 * `typing.update` are the persona-level events of AURAD-0001 — emission is
 * AURAT-0009, the app already handles them (and their absence) gracefully.
 */
export const WsServerEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message.new'),
    advisorId: AdvisorId,
    message: Message,
  }),
  z.object({
    type: z.literal('presence.update'),
    advisorId: AdvisorId,
    online: z.boolean(),
  }),
  z.object({
    type: z.literal('typing.update'),
    advisorId: AdvisorId,
    typing: z.boolean(),
  }),
]);
export type WsServerEvent = z.infer<typeof WsServerEvent>;

/**
 * FCM data payload of the background ping (data-only by design: message
 * content — PII — never transits FCM plaintext; the app delta-syncs over
 * authenticated REST and renders the persona notification locally).
 */
export const MessagePushData = z.object({
  type: z.literal('message.new'),
  advisorId: AdvisorId,
});
export type MessagePushData = z.infer<typeof MessagePushData>;
