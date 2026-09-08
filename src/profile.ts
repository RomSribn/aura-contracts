import { z } from 'zod';

/**
 * The signed-in person's own profile (`AURAF-0015`, BFF half `AURAT-0063`, app
 * half `AURAT-0062`): `GET /v1/me` and `PATCH /v1/me`.
 *
 * The account itself is created by a verified phone number, and every field
 * here is filled in afterwards or never — so "empty" is the ordinary state of a
 * profile, not a broken one. `phoneE164` is the exception in both directions:
 * it always exists, and it is the one field the app may never write.
 */

/** The longest address a server is obliged to accept (RFC 5321): 64 + 1 + 255, minus brackets. */
export const MAX_EMAIL_LENGTH = 254;

/** Nothing before this is a plausible birth date. */
export const MIN_BIRTH_YEAR = 1900;

/** A name that is one character is a typo on the way to a name, not a name. */
export const MIN_DISPLAY_NAME_LENGTH = 2;

/** Long enough for any name; short enough that a paste cannot be a paragraph. */
export const MAX_DISPLAY_NAME_LENGTH = 64;

/**
 * Something shaped like an address: a local part, one `@`, a dotted domain
 * whose last label is letters.
 *
 * Deliberately not a full RFC 5322 parser. That grammar admits quoted local
 * parts, comments and bracketed IP literals, and a regex that covers it is both
 * famous and unreadable — while still not answering the only question that
 * matters, which is whether mail sent there arrives. Nothing but sending mail
 * answers that, and nothing here sends any: `AURAF-0015` checks the shape of an
 * address, never ownership of it.
 *
 * So the bar is exactly one thing: catch a typo the person can see and fix — a
 * missing `@`, a trailing comma, `gmail.con`-shaped nonsense with no dot at all
 * — without ever rejecting an address that works. When in doubt it accepts: a
 * false "that email is invalid" is a dead end for the user, while a bad address
 * costs us one bounce.
 *
 * This is the app's own rule, moved here verbatim rather than re-derived. A
 * server stricter than the screen it serves would refuse an address the screen
 * had just called valid, and the person would have no way to tell which of the
 * two was wrong.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

/**
 * An address as it is stored: trimmed, lower-cased, shape-checked.
 *
 * Lower-casing is a normalisation, not a validation — the local part is
 * case-sensitive by the letter of the RFC and case-insensitive at every mail
 * provider anyone actually uses. Doing it in the contract rather than in the
 * BFF is what lets the app show what was stored instead of what was typed:
 * `PATCH` answers with the server's own version of the profile.
 */
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_EMAIL_LENGTH, `email must not exceed ${MAX_EMAIL_LENGTH} characters`)
  .regex(EMAIL_SHAPE, 'email must be a valid address');
export type Email = z.infer<typeof Email>;

/** Whether `YYYY-MM-DD` names a day that exists — the 31st of a 30-day month does not. */
const isRealCalendarDay = (value: string): boolean => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

/**
 * A birth date: `YYYY-MM-DD`, a day that exists, no earlier than 1900.
 *
 * A calendar day rather than a timestamp, and the distinction is the whole
 * point: a birthday has no time and no zone, so an instant would let it drift
 * across midnight into the day before. The BFF stores it in a `DATE` column for
 * the same reason.
 *
 * The calendar check is here and not only in the app because `2026-02-31` is
 * the right shape and not a date — it would reach Postgres as a `DATE` literal
 * and fail there, turning a typo into a 500.
 *
 * **Not** checked here: whether the date is in the future. That depends on
 * whose clock is asked — the device's calendar or the server's — and the two
 * disagree by up to a day. Each side applies its own bound (`AURAT-0063`).
 */
export const BirthDate = z.string().superRefine((value, ctx) => {
  // One reason at a time, deliberately: the BFF joins every issue into the
  // text of its `400`, and "must be YYYY-MM-DD; is not a day that exists" says
  // the same thing twice about one typo.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'birthDate must be YYYY-MM-DD' });
    return;
  }
  if (!isRealCalendarDay(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'birthDate is not a day that exists' });
    return;
  }
  if (Number(value.slice(0, 4)) < MIN_BIRTH_YEAR) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `birthDate must not be earlier than ${MIN_BIRTH_YEAR}`,
    });
  }
});
export type BirthDate = z.infer<typeof BirthDate>;

/**
 * `GET /v1/me` and the body `PATCH /v1/me` answers with — the profile as the
 * server holds it.
 *
 * Deliberately **looser than the write schema**: the fields are plain nullable
 * strings, not `Email` and `BirthDate`. A response is not user input, and a
 * value the server stored before a rule tightened must not be able to fail the
 * read and take the rest of the profile down with it. `.catch(null)` on the
 * birth date says the same thing about shape: a date served in an unexpected
 * form blanks that one field rather than the whole profile.
 *
 * `marketingOptIn` is the one non-nullable field: consent is a yes or a no, and
 * a row that has never been asked is a no.
 */
export const ProfileResponse = z.object({
  displayName: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  birthDate: BirthDate.nullable().catch(null).default(null),
  /**
   * From the verified sign-in token. Read-only everywhere: it is the identity
   * the account is keyed by, not a contact detail the owner maintains.
   */
  phoneE164: z.string().nullable().default(null),
  marketingOptIn: z.boolean().default(false),
});
export type ProfileResponse = z.infer<typeof ProfileResponse>;

/**
 * Body of `PATCH /v1/me`. Every field optional, and an absent field means
 * "leave it alone" — which is what lets Edit Profile send only what changed and
 * Create Account send only what was filled in.
 *
 * `.strict()`, so a field this contract does not know is a `400` rather than a
 * write that silently does nothing. The same request shape has to keep working
 * for a body of `{ birthDate }` alone: that is what the shipped horoscope sheet
 * sends (`AURAT-0041`), and it reaches a deployed server long before the app
 * that knows about the rest of the profile.
 */
export const ProfilePatchRequest = z
  .object({
    /** Trimmed before it is measured — `"  A  "` is a one-character name. */
    displayName: z
      .string()
      .trim()
      .min(
        MIN_DISPLAY_NAME_LENGTH,
        `displayName must be at least ${MIN_DISPLAY_NAME_LENGTH} characters`,
      )
      .max(
        MAX_DISPLAY_NAME_LENGTH,
        `displayName must not exceed ${MAX_DISPLAY_NAME_LENGTH} characters`,
      )
      .optional(),

    /**
     * An address, or an erasure. **Both `null` and `""` erase it**, and the
     * empty string is not a leniency: it is what the Edit Profile field sends
     * when the address is cleared, because a text input that has been emptied
     * holds `""` and the form sends the field it was asked to send. Rejecting
     * it would make "delete my email" a `400`.
     */
    email: z
      .string()
      .nullable()
      // Normalise first, judge after: the checks below then speak about the
      // address that would actually be stored. Built out of the same
      // `EMAIL_SHAPE` as `Email` rather than out of `Email` itself — a union
      // with an "empty" branch reports a failed address as "must contain at
      // most 0 characters", which is the wrong half of the rule to show a
      // person who mistyped their email.
      .transform((value) => value?.trim().toLowerCase() ?? '')
      .refine(
        (value) => value.length <= MAX_EMAIL_LENGTH,
        `email must not exceed ${MAX_EMAIL_LENGTH} characters`,
      )
      .refine((value) => value === '' || EMAIL_SHAPE.test(value), 'email must be a valid address')
      .transform((value) => (value === '' ? null : value))
      .optional(),

    /** `null` clears the date — and with it the zodiac sign derived from it. */
    birthDate: BirthDate.nullable().optional(),

    marketingOptIn: z.boolean().optional(),

    /**
     * Declared only so that sending it is refused **by name**. Without this
     * key, `.strict()` would still refuse the request, but as "unrecognized
     * key" — indistinguishable from a typo, when the actual answer is that the
     * phone number comes from the verified token and is not the owner's to
     * write. Never present in a valid body; `?: never` also makes it a
     * compile-time error to build one.
     */
    phoneE164: z.never({
      invalid_type_error: 'phoneE164 is read-only: it comes from the verified sign-in token',
    }).optional(),
  })
  .strict();
export type ProfilePatchRequest = z.infer<typeof ProfilePatchRequest>;
