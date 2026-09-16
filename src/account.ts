import { z } from 'zod';

/**
 * Deleting one's own account (`AURAT-0042`): `DELETE /v1/me`, no body.
 *
 * - **`204`** — the account is deleted. The same call repeated with the same
 *   token is `204` again: a response lost on the way back must be safe to
 *   retry, and "make sure this account is gone" is already true.
 * - **`409`** with `ApiError.code` from `AccountDeletionRefusalCode` — nothing
 *   was deleted, and the app goes on working with the same token.
 *
 * After a `204` the identity the device is signed in as no longer exists. For
 * as long as the device still holds a token for it (at most an hour), every
 * other route answers `401` with `ApiError.code === ACCOUNT_DELETED`, and the
 * WebSocket is closed — or refused at the handshake — with code `4401` and
 * reason `ACCOUNT_DELETED`. The app signs out locally and calls nothing else,
 * in particular **not** `DELETE /v1/devices/:token`: the server has already
 * removed every push token, and that call would only earn the same `401`.
 *
 * What survives is decided by the server, not by this contract, and the
 * confirmation screen has to say it BEFORE the tap: payments and the accounting
 * trail stay (anonymised, for the retention period in the privacy policy), a
 * star rating left for an advisor stays as an anonymous rating with no text,
 * and **any wallet balance is lost** — there is no refund on deletion.
 */

/**
 * Named in `ApiError.code` when a deletion is refused.
 *
 * Unlike `SendRefusalCode` or `ReviewRefusalCode`, this one is NOT final: the
 * same request succeeds once the reason is gone. What it forbids is retrying
 * *unchanged* — the app should tell the person what to do first.
 */
export const AccountDeletionRefusalCode = z.enum([
  /**
   * A paid session is booked or running. HTTP 409. The person cancels an
   * upcoming one (refunded by the usual 24-hour rule) or lets a running one
   * end, then asks again. Deleting never moves money on their behalf.
   */
  'account_has_live_sessions',
]);
export type AccountDeletionRefusalCode = z.infer<typeof AccountDeletionRefusalCode>;

/**
 * `ApiError.code` of the `401` any route answers once the caller's account has
 * been deleted, and the reason the WebSocket is closed with. Distinct from a
 * plain expired token, which carries no code: the right reaction to this one is
 * to sign out, not to refresh the token and try again.
 */
export const ACCOUNT_DELETED = 'account_deleted';
