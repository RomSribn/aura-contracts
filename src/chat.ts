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
/**
 * Path-parameter guard for `GET /v1/attachments/:attachmentId`.
 *
 * Strict on the way IN and deliberately absent from `MessageAttachment.id`
 * below, which stays a plain string. That asymmetry is the lesson of v0.8.2:
 * `SessionId` was briefly applied to a *response* field too, where a stricter
 * format would have rejected our own data the day the id generator changed.
 * A value arriving from a device is checked before it reaches the database; a
 * value we minted ourselves is not re-checked on the way out.
 */
export const AttachmentId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, 'attachmentId must be 1-64 chars of [A-Za-z0-9_-]');
export type AttachmentId = z.infer<typeof AttachmentId>;

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
  /**
   * The key this message was sent with, when we sent it (`AURAT-0037`). Null
   * for everything the agent desk originated and everything sent before keys
   * existed.
   *
   * Published so the app can recognise its OWN message in what the
   * reconciliation poll brings back. Without it a send that reached the desk
   * while its reply did not leaves the app showing "not delivered" next to a
   * message that plainly was delivered — true only until the user presses
   * retry, which is the wrong sort of untruth for a feature that exists
   * because files were being lost silently.
   *
   * Matching on direction, file name and a time window instead would be
   * guessing, and it would fold two deliberately identical photos into one.
   *
   * Deliberately a PLAIN STRING here, not `IdempotencyKey` — the same
   * asymmetry v0.8.2 settled for `SessionId`, and worth restating because the
   * strict version is the obvious thing to write. On the way in the format is
   * checked; on the way out it is not. The stored value is whatever the desk
   * echoed in its `source_id`, a field the provider also writes to itself, so
   * a value shorter than the minimum could exist — and a client running
   * `safeParse` would then drop the ENTIRE message rather than one field,
   * making a message disappear from the thread to enforce a rule about a value
   * nothing reads.
   */
  idempotencyKey: z.string().nullable().default(null),
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

/**
 * Client-generated id for one composed message, so a re-send is recognised as
 * the same message rather than a second one (`AURAT-0032`).
 *
 * It exists because the app is *required* to offer a retry (`AURAF-0011-009`)
 * and, without a key, retrying is how a file gets delivered twice: an upload
 * can reach the agent desk and be committed there while the reply never reaches
 * the phone, and the BFF's reconciliation poll then recovers that same message
 * on its own within a minute. The key is what lets the recovered message and
 * the retried one be recognised as one thing.
 *
 * Generate it when the message is composed, not when it is sent — a new key per
 * attempt would defeat the whole point.
 */
export const IdempotencyKey = z.string().min(8).max(64);
export type IdempotencyKey = z.infer<typeof IdempotencyKey>;

/**
 * Body of `POST /v1/advisors/:advisorId/messages`.
 *
 * Also the JSON half of the multipart form when a file is attached: the same
 * field names, sent as form fields beside `attachments[]`.
 *
 * `content` may now be empty, because an attachment can be sent with no
 * caption. Empty content AND no file is still refused — by the service, which
 * can see both halves, rather than by this schema, which cannot.
 *
 * `idempotencyKey` is OPTIONAL, and deliberately so. The server validates every
 * send against this schema, and the shipped app does not send the field yet;
 * making it required would reject every message from every phone already in
 * people's hands. A send without it simply gets no retry protection — which is
 * exactly the situation before this version.
 */
export const SendMessageRequest = z.object({
  content: z.string().trim().max(4000).default(''),
  idempotencyKey: IdempotencyKey.optional(),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequest>;

/**
 * Why a send was refused, when it was refused for a reason the app should act
 * on differently (`AURAT-0032`). Returned in the `code` of the standard
 * `ApiError` body.
 *
 * The distinction that matters is retryable vs not. Until now every failure of
 * the send path collapsed into one 502 "agent desk unavailable, try again",
 * which is a lie for a file that will never be accepted — and offering a retry
 * that cannot succeed is a loop, not honesty. A code here means: do not retry,
 * tell the user what to change.
 *
 * The absence of a code (a plain 502) keeps its old meaning: try again.
 */
export const SendRefusalCode = z.enum([
  /** Over `AttachmentLimits.maxBytes`. HTTP 413. */
  'attachment_too_large',
  /** The bytes are not one of `AttachmentLimits.acceptedTypes`. HTTP 415. */
  'attachment_type_not_accepted',
  /** More files than `AttachmentLimits.maxPerMessage`. HTTP 413. */
  'too_many_attachments',
  /** Neither text nor a file — there is nothing to send. HTTP 400. */
  'message_empty',
  /** The agent desk refused it outright; retrying sends it again for nothing. HTTP 422. */
  'refused_by_agent_desk',
]);
export type SendRefusalCode = z.infer<typeof SendRefusalCode>;

/**
 * What the app may attach, and how much of it (`AURAT-0032`).
 *
 * These are OUR limits, and there is no external floor to lean on: Chatwoot
 * validates neither size nor type for an API-channel inbox — its 40 MB and its
 * type allowlist apply only to the website widget. If we do not bound this,
 * nothing does.
 *
 * Published in the contract rather than kept server-side so the app can refuse
 * an over-sized file before spending the user's mobile data on it, and show the
 * reason. The server re-checks everything regardless, by CONTENT and never by
 * the declared type.
 */
export const AttachmentLimits = {
  maxBytes: 25 * 1024 * 1024,
  /** One per message for now; raising this is additive, lowering it is not. */
  maxPerMessage: 1,
  /**
   * Accepted MIME types, matched against what the bytes actually are.
   *
   * Note what is absent: text/plain and text/csv. Neither has a signature to
   * sniff, so accepting them would mean trusting the client's declared type in
   * the one place this feature exists not to. A deliberate loss, not an
   * oversight.
   */
  acceptedTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/opus',
    'audio/wav',
    'audio/amr',
    'audio/webm',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/3gpp',
    'application/pdf',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
} as const;

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
