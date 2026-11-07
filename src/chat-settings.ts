import { z } from 'zod';

/**
 * The person's chat settings (`AURAF-0024`, research `AURAI-0012` §2,
 * decisions 3–6): the language their advisors' replies are translated into,
 * the "translate my chat" switch, and the consent given before the first chat
 * message. Read as `ProfileResponse.chat`; written by
 * `PATCH /v1/me/chat-settings`, which answers with the whole `ProfileResponse`,
 * as the avatar routes do.
 */

/**
 * Version of the consent text a client shows before the first chat message
 * (decision 6). The text itself is the client's, in the client's languages;
 * this number is what both sides agree it is.
 *
 * A materially new text is the next number, in a minor release of this
 * package. A consent of an earlier version no longer counts for translation:
 * the client asks again.
 *
 * Order of rollout: a new version ships on the server first, in clients
 * after. `ChatSettingsPatchRequest.consentVersion` is capped at this number,
 * so a server still on an older package answers `400` to a version newer than
 * its own. A client that gets that `400` is ahead of the server: it shows the
 * text of the version the server knows, or simply leaves translation off — it
 * never blocks the chat over it.
 */
export const CHAT_CONSENT_VERSION = 1;

/**
 * A consent as the server stored it. `givenAt` is ISO-8601 and the server's
 * own clock, never the client's. Plain on the way out, as response fields in
 * this package are.
 */
export const ChatConsent = z.object({
  version: z.number().int().positive(),
  givenAt: z.string(),
});
export type ChatConsent = z.infer<typeof ChatConsent>;

export const ChatSettings = z.object({
  /**
   * The language replies are translated into — one per person, for every
   * advisor (decision 5). Read-only: only a message send writes it, from that
   * send's `?lang` (see `SendMessageRequest`), and the latest send wins. A
   * send without `?lang` leaves it alone; `en` overwrites it — a person may go
   * back to English.
   *
   * `en` or `null` (never set) — replies are not translated and nothing is
   * called (decision 4). Replies are in the language of the interface, not of
   * whatever the person happens to write in (decision 3).
   */
  language: z.string().min(1).nullable().default(null),
  /**
   * The "translate my chat" switch in the profile. It works both ways: the
   * replies, and the English the agent desk gets of the person's messages.
   * Switching it off is how translation is withdrawn.
   */
  translationEnabled: z.boolean().default(false),
  /**
   * The explicit consent ticked before the first chat message (decision 6):
   * to sensitive information in chats being processed, including AI
   * translation by the provider (Anthropic, USA). A consent to the chat, not
   * "to translation" — which is why it lives here and not on the switch.
   *
   * `null` — never given. Show the checkbox before the first message when this
   * is `null` or its `version` is below `CHAT_CONSENT_VERSION`. Sending is not
   * refused without it — builds that never show the checkbox must keep
   * chatting — there is simply no translation.
   */
  consent: ChatConsent.nullable().catch(null).default(null),
});
export type ChatSettings = z.infer<typeof ChatSettings>;

/**
 * Body of `PATCH /v1/me/chat-settings`. Every field optional; an absent field
 * leaves the setting alone. `.strict()`, so a field this contract does not
 * know — `language` included, which only a send writes — is a `400`.
 *
 * A route of its own, not fields of `PATCH /v1/me`: a server running this
 * package before it implements chat settings would accept such fields there
 * and silently store nothing, while an unknown route is an honest `404`.
 */
export const ChatSettingsPatchRequest = z
  .object({
    /**
     * The version of the consent text the person just ticked. The server
     * stamps the time. The same or an earlier version than the stored one
     * changes nothing, `givenAt` included. A consent of the current version
     * turns translation on, unless the same body says
     * `translationEnabled: false`.
     *
     * Capped at `CHAT_CONSENT_VERSION` of the package the server runs: a
     * newer version is a `400` — see `CHAT_CONSENT_VERSION` for the rollout
     * order and what the client does then.
     */
    consentVersion: z.number().int().min(1).max(CHAT_CONSENT_VERSION).optional(),
    /**
     * The switch. `true` needs a consent of `CHAT_CONSENT_VERSION`, stored or
     * in the same body — otherwise `409 chat_consent_required`. `false` is
     * always accepted: it is the withdrawal. The chat as a whole is withdrawn
     * by deleting the account.
     */
    translationEnabled: z.boolean().optional(),
  })
  .strict();
export type ChatSettingsPatchRequest = z.infer<typeof ChatSettingsPatchRequest>;

/**
 * Why `PATCH /v1/me/chat-settings` was refused, in the `code` of the standard
 * `ApiError` body. Same purpose as `SendRefusalCode`: do not retry, ask the
 * person.
 */
export const ChatSettingsRefusalCode = z.enum([
  /** `translationEnabled: true` without a consent of `CHAT_CONSENT_VERSION`. HTTP 409. */
  'chat_consent_required',
]);
export type ChatSettingsRefusalCode = z.infer<typeof ChatSettingsRefusalCode>;
