import { z } from 'zod';
import { AdvisorId } from './advisor';

/**
 * Paid fixed-minute session (AURAD-0002): a block of prepaid minutes consumed
 * inside the one durable advisor thread (AURAD-0003), **non-refundable once
 * started**. Money is always integer USD minor units (cents).
 *
 * Aligned with the BFF as built by `AURAT-0008`
 * (`aura-bff/src/contracts/session.ts`). The client never sends a price or a
 * cost: it books `minutes`, and the server resolves the advisor's price,
 * computes the charge and debits it inside a locked transaction.
 */
export const SessionStatus = z.enum(['ACTIVE', 'FINISHED']);
export type SessionStatus = z.infer<typeof SessionStatus>;

/** How a session ended: the meter ran the block down, or the user ended early. */
export const SessionFinishReason = z.enum(['EXHAUSTED', 'ENDED_EARLY']);
export type SessionFinishReason = z.infer<typeof SessionFinishReason>;

export const Session = z.object({
  id: z.string(),
  advisorId: AdvisorId,
  status: SessionStatus,
  /** Total booked minutes including extensions; booked == paid (non-refundable). */
  bookedMinutes: z.number().int().positive(),
  /** Booking-time snapshot — a later advisor price change never rewrites it. */
  priceMinorPerMinute: z.number().int().positive(),
  /** Total charged so far (booking + every extension). */
  costMinor: z.number().int().positive(),
  /** ISO 8601. */
  startedAt: z.string(),
  /**
   * ISO 8601; moves forward on extend. The app derives its countdown and the
   * near-end "extend" prompt locally from this — there is no server warning.
   */
  endsAt: z.string(),
  finishedAt: z.string().nullable(),
  finishReason: SessionFinishReason.nullable(),
});
export type Session = z.infer<typeof Session>;

/**
 * Body of `POST /v1/advisors/:advisorId/sessions`. `minutes` must be one of the
 * blocks the pricing endpoint offers (the allowed set is server config).
 * `idempotencyKey` is client-generated: replaying it must never debit twice.
 */
export const BookSessionRequest = z.object({
  minutes: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
});
export type BookSessionRequest = z.infer<typeof BookSessionRequest>;

/** Body of `POST /v1/sessions/:sessionId/extend` — another block, same window. */
export const ExtendSessionRequest = BookSessionRequest;
export type ExtendSessionRequest = z.infer<typeof ExtendSessionRequest>;

/** Response of booking and of extending: the session plus the new wallet balance. */
export const BookSessionResponse = z.object({
  session: Session,
  balanceMinor: z.number().int(),
});
export type BookSessionResponse = z.infer<typeof BookSessionResponse>;

/** Response of `POST /v1/sessions/:sessionId/finish` (early end, idempotent). */
export const FinishSessionResponse = z.object({
  session: Session,
});
export type FinishSessionResponse = z.infer<typeof FinishSessionResponse>;

/** Response of `GET /v1/advisors/:advisorId/sessions/active`. */
export const ActiveSessionResponse = z.object({
  session: Session.nullable(),
});
export type ActiveSessionResponse = z.infer<typeof ActiveSessionResponse>;

/**
 * Response of `GET /v1/advisors/:advisorId/sessions/pricing` — display-only
 * figures read from the same source the debit uses, so the app shows exactly
 * what the server will charge. An advisor with no registered price is not
 * bookable at all (404), never billed at some default.
 */
export const SessionPricing = z.object({
  priceMinorPerMinute: z.number().int().positive(),
  blocks: z.array(
    z.object({
      minutes: z.number().int().positive(),
      costMinor: z.number().int().positive(),
    }),
  ),
});
export type SessionPricing = z.infer<typeof SessionPricing>;
