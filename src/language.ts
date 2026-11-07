/**
 * The languages Aura speaks (`AURAF-0023`; BFF `AURAT-0168`, app `AURAT-0169`,
 * web `AURAT-0170`): English and the other 23 official languages of the EU — the
 * same set, in the same order, as `shared/config/languages.ts` in the app and
 * the web.
 *
 * A client states the language it is showing as `?lang=<code>` on its JSON
 * requests and its uploads — never on the address of a picture or an
 * attachment, which is served `immutable` and doubles as the client's cache
 * key, and never on the socket. `Accept-Language` is not a signal: iOS sends
 * the device language there even from an English-only build.
 *
 * Everywhere but one place it lasts for that one request. The exception is a
 * message send: its `?lang` becomes the person's chat language
 * (`ChatSettings.language`, `AURAF-0024`), so a client that offers no choice
 * of language leaves `?lang` off its sends.
 *
 * A value the server does not know is not an error. It answers in
 * `SOURCE_LANGUAGE` instead, as it does for a language switched off in
 * `AppConfigResponse.disabledLanguages` — never a `400`.
 */
export const LANGUAGES = [
  'en',
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'es',
  'et',
  'fi',
  'fr',
  'ga',
  'hr',
  'hu',
  'it',
  'lt',
  'lv',
  'mt',
  'nl',
  'pl',
  'pt',
  'ro',
  'sk',
  'sl',
  'sv',
] as const;
export type Language = (typeof LANGUAGES)[number];

/**
 * The language everything is written in first, and the fallback for every other.
 * `satisfies`, not an annotation: the literal type `'en'` is kept, so a client can
 * write `Exclude<Language, typeof SOURCE_LANGUAGE>` for the languages that need a
 * translation file.
 */
export const SOURCE_LANGUAGE = 'en' satisfies Language;

/** The query parameter a client states its language in. */
export const LANGUAGE_QUERY_PARAM = 'lang';

const KNOWN: ReadonlySet<string> = new Set(LANGUAGES);

/**
 * Exactly one of `LANGUAGES` — no normalisation: `DE` and `de-AT` are not
 * languages here, because every client sends a code from this same list.
 */
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && KNOWN.has(value);
}
