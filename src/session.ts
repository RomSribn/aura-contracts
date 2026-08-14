import { z } from 'zod';
import { AdvisorId } from './advisor';

/**
 * Paid session (AURAD-0009): a **scheduled** block of prepaid minutes, consumed
 * inside the one durable advisor thread (AURAD-0003). Money is always integer
 * USD minor units (cents).
 *
 * The rail is the prepaid wallet, not a card — the design pays the slot by card
 * but that needs a PSP which does not exist, so `AURAD-0009` keeps the wallet
 * and every screen of the flow can complete. Refunds exist **only before the
 * session starts** (≥24h full, <24h half); once it is running, `AURAD-0002`'s
 * rule still holds and the remaining minutes are forfeited.
 *
 * The client never sends a price, a cost or a discount: it sends *when* and
 * *how long*, and the server resolves the advisor's price, applies any credit,
 * computes the charge and moves the money inside a locked transaction
 * (`AURAT-0008` D1).
 */
export const SessionStatus = z.enum([
  /** Booked and paid for, waiting for its slot. */
  'SCHEDULED',
  /** Its slot arrived; the meter is running. */
  'ACTIVE',
  'FINISHED',
  /** Cancelled before it started; see `refundedMinor` on the cancel response. */
  'CANCELLED',
]);
export type SessionStatus = z.infer<typeof SessionStatus>;

/** How a session ended: the meter ran the block down, or the user ended early. */
export const SessionFinishReason = z.enum(['EXHAUSTED', 'ENDED_EARLY']);
export type SessionFinishReason = z.infer<typeof SessionFinishReason>;

export const Session = z.object({
  id: z.string(),
  advisorId: AdvisorId,
  status: SessionStatus,
  /** Total booked minutes including extensions; booked == paid. */
  bookedMinutes: z.number().int().positive(),
  /** Booking-time snapshot — a later advisor price change never rewrites it. */
  priceMinorPerMinute: z.number().int().positive(),
  /** Total charged so far, credits already applied (booking + every extension). */
  costMinor: z.number().int().nonnegative(),
  /**
   * ISO 8601 — the slot the user booked. Present from the moment of booking and
   * the only timestamp a `SCHEDULED` session has; `rescheduleSession` moves it.
   */
  startsAt: z.string(),
  /**
   * ISO 8601 — when the meter actually began, which is the server's own clock
   * reading at the transition, not the booked time. Null while `SCHEDULED`.
   */
  startedAt: z.string().nullable(),
  /**
   * ISO 8601; moves forward on extend. The app derives its countdown and the
   * near-end "extend" prompt locally from this — there is no server warning.
   * While `SCHEDULED` this is the planned end (`startsAt` + `bookedMinutes`).
   */
  endsAt: z.string(),
  finishedAt: z.string().nullable(),
  finishReason: SessionFinishReason.nullable(),
});
export type Session = z.infer<typeof Session>;

/**
 * Body of `POST /v1/advisors/:advisorId/sessions`.
 *
 * `startsAt` must be a slot the availability endpoint offered and `minutes` one
 * of the durations pricing offers — the server re-checks both, since a slot can
 * be taken between the read and the booking. `idempotencyKey` is
 * client-generated: replaying it must never debit twice.
 */
export const BookSessionRequest = z.object({
  startsAt: z.string(),
  minutes: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
});
export type BookSessionRequest = z.infer<typeof BookSessionRequest>;

/**
 * Body of `POST /v1/sessions/:sessionId/extend` — more minutes on the session
 * that is already running, which is a different act from booking one and needs
 * no slot.
 */
export const ExtendSessionRequest = z.object({
  minutes: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
});
export type ExtendSessionRequest = z.infer<typeof ExtendSessionRequest>;

/** Body of `PATCH /v1/sessions/:sessionId` — free up to 4h before the start. */
export const RescheduleSessionRequest = z.object({
  startsAt: z.string(),
});
export type RescheduleSessionRequest = z.infer<typeof RescheduleSessionRequest>;

/** Response of booking, extending and rescheduling: the session and the balance. */
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

/**
 * Response of `POST /v1/sessions/:sessionId/cancel`.
 *
 * `refundedMinor` is what actually went back to the wallet, computed by the
 * server from the hours remaining — the app renders the figure, it never
 * decides the policy. Cancelling a session that has already started is refused
 * (409), not silently refunded at zero.
 */
export const CancelSessionResponse = z.object({
  session: Session,
  refundedMinor: z.number().int().nonnegative(),
  balanceMinor: z.number().int(),
});
export type CancelSessionResponse = z.infer<typeof CancelSessionResponse>;

/** Response of `GET /v1/advisors/:advisorId/sessions/active`. */
export const ActiveSessionResponse = z.object({
  session: Session.nullable(),
});
export type ActiveSessionResponse = z.infer<typeof ActiveSessionResponse>;

/**
 * Response of `GET /v1/sessions` — every session of the signed-in user, newest
 * `startsAt` first, across all advisors. The Sessions tab splits it into
 * Upcoming (`SCHEDULED` + `ACTIVE`) and Past (`FINISHED`); `CANCELLED` ones are
 * not shown, but are returned so the app never has to infer their absence.
 */
export const SessionsResponse = z.object({
  sessions: z.array(Session),
});
export type SessionsResponse = z.infer<typeof SessionsResponse>;

/**
 * One bookable start time. The server decides what is offerable — a slot inside
 * its own lead time, or one already taken, simply is not `available`, and the
 * app never re-derives that from a clock it does not own.
 */
export const SessionSlot = z.object({
  /** ISO 8601 start. */
  startsAt: z.string(),
  available: z.boolean(),
});
export type SessionSlot = z.infer<typeof SessionSlot>;

/**
 * Query of `GET /v1/advisors/:advisorId/sessions/availability`.
 *
 * `tz` is an IANA zone and decides **only which day a slot is filed under**,
 * never when it happens: the grid is anchored in UTC because occupancy is
 * global — every client has to be talking about the same instants. Omitting it
 * groups by the server's configured zone, so a client whose user is hours away
 * from it sees evening slots listed under the neighbouring day. Send the
 * device's zone.
 *
 * `days` is capped server-side by the booking horizon; asking for more is an
 * error rather than a silent trim.
 */
export const AvailabilityQuery = z.object({
  days: z.coerce.number().int().min(1).max(14).default(14),
  tz: z.string().optional(),
});
export type AvailabilityQuery = z.infer<typeof AvailabilityQuery>;

/**
 * Response of `GET /v1/advisors/:advisorId/sessions/availability`.
 *
 * Days come back whole — including ones with nothing free — so the date strip
 * can show a day as full rather than hiding it and leaving the user to guess.
 */
export const AvailabilityResponse = z.object({
  days: z.array(
    z.object({
      /** `YYYY-MM-DD` in the query's `tz`, or the server's zone if none. */
      date: z.string(),
      slots: z.array(SessionSlot),
    }),
  ),
});
export type AvailabilityResponse = z.infer<typeof AvailabilityResponse>;

/**
 * Response of `GET /v1/advisors/:advisorId/sessions/pricing` — display-only
 * figures read from the same source the debit uses, so the app shows exactly
 * what the server will charge. An advisor with no registered price is not
 * bookable at all (404), never billed at some default.
 *
 * The breakdown is per duration because the credit is not proportional: it is a
 * flat first-session discount, so the app must not derive one block's total
 * from another's.
 */
export const SessionPricing = z.object({
  priceMinorPerMinute: z.number().int().positive(),
  blocks: z.array(
    z.object({
      minutes: z.number().int().positive(),
      /** `priceMinorPerMinute × minutes`, before any credit. */
      subtotalMinor: z.number().int().positive(),
      /** Flat first-session credit; 0 once the user has had a session. */
      creditMinor: z.number().int().nonnegative(),
      /** What the wallet will actually be debited — never recomputed app-side. */
      costMinor: z.number().int().nonnegative(),
    }),
  ),
});
export type SessionPricing = z.infer<typeof SessionPricing>;
