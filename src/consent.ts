import { z } from 'zod';

import { LANGUAGES } from './language';

/**
 * Consents a person gives by ticking an empty box at the moment of the act
 * (`AURAD-0024`; BFF, web and app `AURAT-0216`, web `AURAT-0218`): before every
 * booking, every session started now and every extension — "I want it at this
 * time, and I understand I cannot withdraw once it has taken place"
 * (Directive 2011/83/EU art. 16(a)) — and, on the web, to our Terms before a
 * card payment. The server stores each one with the act it belongs to, in the
 * same transaction: the time is the server's clock, never the client's.
 *
 * A consent travels **inside the request of the act** (`BookSessionRequest`,
 * `ExtendSessionRequest`, `CardTopUpRequest`) — there is no route of its own.
 *
 * Rules for the clients:
 *
 * - send the field **only** when the box was ticked for this very press. The
 *   box starts empty, and the button stays disabled until it is ticked, so a
 *   request without a ticked box does not exist;
 * - every extension is its own box and its own field — a consent is never
 *   remembered for the next one;
 * - `language` is the language the box's text was shown in;
 * - **the text of a box changes, in any language, only together with a new
 *   version.** The web and the app each keep a test that pins all 24
 *   translations of every version (a snapshot or a hash), so that editing a
 *   translation without a new version fails CI. Otherwise "version + language"
 *   does not prove which words the person saw;
 * - a client takes the version only from here — no constant of its own.
 *
 * A new version is added here, released in the BFF first, and only then sent
 * by a client: the server refuses a version it does not know. Old versions are
 * never removed — a record carries the version it was given with forever.
 */

/** Booking a slot (`BookSessionRequest` with `startsAt`). */
export const BOOKING_CONSENT_VERSIONS = ['booking-v1'] as const;
/** A session started now (`BookSessionRequest` with `startNow: true`). */
export const NOW_CONSENT_VERSIONS = ['now-v1'] as const;
/** More minutes on the running session (`ExtendSessionRequest`). */
export const EXTENSION_CONSENT_VERSIONS = ['extension-v1'] as const;
/**
 * The Terms of Service, before a card payment on the web
 * (`CardTopUpRequest.termsConsent`).
 *
 * `terms-v1` — the Terms published by `AURAT-0209` ("Last updated" is the date
 * of publication; a snapshot of the page is kept in the brain under
 * `AURAT-0209`). The version names the document agreed to, not the wording of
 * the box.
 */
export const TERMS_CONSENT_VERSIONS = ['terms-v1'] as const;

/**
 * The English text of each session box — what the person confirmed, in their
 * own language. The translations live in the clients, pinned by their tests.
 */
export const SESSION_CONSENT_TEXTS = {
  'booking-v1':
    'I want this session at the time I chose. I understand that once it has taken place, I can no longer withdraw from it.',
  'now-v1':
    'I want this session to start now. I understand that once it has taken place, I can no longer withdraw from it.',
  'extension-v1':
    'I want these minutes now. I understand that once they have been used, I can no longer withdraw from them.',
} as const satisfies Record<
  | (typeof BOOKING_CONSENT_VERSIONS)[number]
  | (typeof NOW_CONSENT_VERSIONS)[number]
  | (typeof EXTENSION_CONSENT_VERSIONS)[number],
  string
>;

export const SessionConsentVersion = z.enum([
  ...BOOKING_CONSENT_VERSIONS,
  ...NOW_CONSENT_VERSIONS,
  ...EXTENSION_CONSENT_VERSIONS,
]);
export type SessionConsentVersion = z.infer<typeof SessionConsentVersion>;

export const TermsConsentVersion = z.enum(TERMS_CONSENT_VERSIONS);
export type TermsConsentVersion = z.infer<typeof TermsConsentVersion>;

/**
 * The box of a booking, a session started now or an extension was ticked.
 * The version must be one of the act's own (booking, now, extension) — another
 * act's version is 400 `consent_invalid`.
 */
export const SessionConsent = z.object({
  version: SessionConsentVersion,
  language: z.enum(LANGUAGES),
});
export type SessionConsent = z.infer<typeof SessionConsent>;

/**
 * The box of an extension was ticked — narrowed to the extension's own
 * versions, so a client cannot even type another act's; the server's 400
 * `consent_invalid` stays as the backstop.
 */
export const ExtensionConsent = z.object({
  version: z.enum(EXTENSION_CONSENT_VERSIONS),
  language: z.enum(LANGUAGES),
});
export type ExtensionConsent = z.infer<typeof ExtensionConsent>;

/** The Terms box of a card payment on the web was ticked. */
export const TermsConsent = z.object({
  version: TermsConsentVersion,
  language: z.enum(LANGUAGES),
});
export type TermsConsent = z.infer<typeof TermsConsent>;

/**
 * `ApiError.code` of the 400 when the server needs a consent the request did
 * not carry: a booking, a session started now or an extension from the web
 * while the server requires them there, or a new card payment while the
 * server collects the Terms consent itself. Nothing is charged or started.
 * The app is never refused for a missing session consent — its old versions
 * do not send one.
 */
export const CONSENT_REQUIRED = 'consent_required';

/**
 * `ApiError.code` of the 400 when the consent is another act's: `now-v1` on a
 * booking for a time, `booking-v1` on a session started now, anything but an
 * extension version on an extension. Nothing is charged.
 */
export const CONSENT_INVALID = 'consent_invalid';
