import { z } from 'zod';
import { AdvisorId } from './advisor';
import { Session } from './session';

/**
 * Chat contract. Since AURAT-0034 this package **is** the single definition —
 * the BFF's `src/contracts/message.ts` re-exports these shapes rather than
 * keeping a second copy of them.
 *
 * Direction is from the user's point of view. The app maps its per-advisor
 * thread 1:1 to a BFF conversation (AURAD-0003).
 *
 * `system` = BFF-authored session markers ("Your session has started /
 * finished", AURAT-0008): stored and delivered as ordinary messages, so they
 * arrive through history and the socket inline with the conversation, and the
 * app renders them as the red session separators (AURAD-0002).
 */
export const MessageDirection = z.enum(['user', 'advisor', 'system']);
export type MessageDirection = z.infer<typeof MessageDirection>;

/**
 * What a chat attachment actually is, as far as the app is concerned. Mirrors
 * the four kinds a chatter can send from the agent desk; everything else the
 * provider can enumerate (locations, contact cards, channel fallbacks) arrives
 * from messenger channels we do not have, and is dropped before it reaches
 * this contract (`AURAF-0011`).
 */
export const AttachmentKind = z.enum(['image', 'audio', 'video', 'file']);
export type AttachmentKind = z.infer<typeof AttachmentKind>;

/**
 * One file hanging off a message (`AURAF-0011`, `AURAD-0011`).
 *
 * There is deliberately **no URL here, of any kind**. `id` is the BFF's own
 * opaque handle, and the bytes come from `GET /v1/attachments/:id` — an
 * authenticated route on our own host. Two independent reasons, either of which
 * would be enough on its own: the agent desk's own link is *unauthenticated*
 * (verified — a request with no headers returns the file), so handing it out
 * would make a leaked link a permanent, unrevocable download; and the provider
 * stays sealed behind the BFF, so its host never reaches a device. A
 * *pre-signed* URL is not the answer either: the app caches the feed, and a URL
 * that expires turns into broken images an hour after the history loaded.
 *
 * `width`/`height` are `null` for anything the desk did not measure — carrying
 * the null is honest, hiding the field would not be.
 */
export const MessageAttachment = z.object({
  id: z.string(),
  kind: AttachmentKind,
  /** MIME type — what the app picks a renderer by. */
  contentType: z.string(),
  /** Original upload name, sanitized; safe to display and to save as. */
  fileName: z.string(),
  fileSizeBytes: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});
export type MessageAttachment = z.infer<typeof MessageAttachment>;

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
  /**
   * Files sent with this message, in the order the desk lists them. An
   * attachment-only message has `content: ''` — which is why `content` did not
   * need to change to carry attachments, and why a client built against an
   * earlier version keeps parsing today's payloads.
   */
  attachments: z.array(MessageAttachment).default([]),
});
export type Message = z.infer<typeof Message>;

/**
 * Ответ `POST /v1/advisors/:advisorId/conversation` — получить или создать
 * тред с советником. `id` — идентификатор BFF; идентификаторы Chatwoot границу
 * не пересекают.
 */
export const EnsureConversationResponse = z.object({
  id: z.string(),
  advisorId: z.string(),
});
export type EnsureConversationResponse = z.infer<typeof EnsureConversationResponse>;

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
 * `message.new` (AURAT-0005) and `session.updated` (AURAT-0008) ship today;
 * `presence.update` and `typing.update` are the persona-level events of
 * AURAD-0001 — emission is AURAT-0009, the app already handles them (and
 * their absence) gracefully.
 */
export const WsServerEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message.new'),
    advisorId: AdvisorId,
    message: Message,
  }),
  // Session lifecycle push (book / extend / finish / cancel, and the
  // SCHEDULED → ACTIVE transition the meter makes on its own). Advisory only:
  // the app derives the running block from `endsAt` and refetches the session
  // itself, so it stays correct while backgrounded or off the socket — which
  // matters more now that a session can start while the user is elsewhere in
  // the app (AURAD-0009).
  z.object({
    type: z.literal('session.updated'),
    advisorId: AdvisorId,
    session: Session,
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
