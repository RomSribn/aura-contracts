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
  /**
   * The photograph, when there is one — an opaque handle, never an address
   * (`AURAD-0013`). The bytes come from `GET /v1/avatars/:avatarId` under the
   * caller's own token, and no storage URL is handed out at any point.
   *
   * It changes on every replacement, and that is what it is for: a cache keyed
   * by this id shows the new face the moment it lands, while a stable address
   * would go on serving the old one. Android does not leave that to headers —
   * Fresco caches by URI and does not read them (`AURAD-0012`).
   *
   * `null` for almost everybody, and permanently so: the brand orb is the
   * design's default portrait, not a placeholder waiting for a photograph.
   */
  avatarId: z.string().nullable().default(null),
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

/**
 * Path-parameter guard for `GET /v1/avatars/:avatarId` (`AURAT-0064`).
 *
 * The same in/out asymmetry as `AttachmentId`: strict on the way in, because
 * that value arrives from a device, and a plain nullable string inside
 * `ProfileResponse`, because that one we minted ourselves and do not re-check
 * on the way out.
 */
export const AvatarId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, 'avatarId must be 1-64 chars of [A-Za-z0-9_-]');
export type AvatarId = z.infer<typeof AvatarId>;

/**
 * Why an avatar upload was refused (`AURAT-0064`). Returned in the `code` of
 * the standard `ApiError` body.
 *
 * Same shape and same purpose as `SendRefusalCode`: a code here means "do not
 * retry, tell the person what to change", and its absence keeps the older
 * meaning of "this may work if you try it again". A picture that has to be
 * swapped for a different one is not a network problem, and offering a retry
 * for it is a loop.
 */
export const AvatarRefusalCode = z.enum([
  /** Over `AvatarLimits.maxBytes`. HTTP 413. */
  'avatar_too_large',
  /** The bytes are not one of `AvatarLimits.acceptedTypes`. HTTP 415. */
  'avatar_type_not_accepted',
  /** Either side exceeds `AvatarLimits.maxPixelsPerSide`. HTTP 413. */
  'avatar_too_many_pixels',
  /** The upload carried no file, or an empty one. HTTP 400. */
  'avatar_empty',
]);
export type AvatarRefusalCode = z.infer<typeof AvatarRefusalCode>;

/**
 * What a profile photograph may be (`AURAT-0064`, `AURAD-0013`).
 *
 * Published in the contract for the same reason as `AttachmentLimits`: so the
 * app can refuse a file before spending the person's mobile data on it. The
 * server re-checks all of it regardless, by CONTENT and never by the declared
 * type.
 *
 * Unlike the attachment limits, these are **not** ours alone to choose. The
 * photograph is also sent on to the agent desk, whose own avatar rules
 * (Chatwoot `Avatarable`) accept 15 MB and only jpeg/png/gif/webp. Anything we
 * take that it will not must therefore be refused HERE — a file accepted by us
 * and rejected there fails on a background job, which is to say silently.
 */
export const AvatarLimits = {
  /**
   * Well under the agent desk's 15 MB, and far above what a resized photograph
   * weighs (200-400 KB). The ceiling is not for the picker — it is for a build
   * that does not resize, and for anything hand-crafted.
   */
  maxBytes: 8 * 1024 * 1024,
  /**
   * We never decode these bytes; the agent desk does, to build its 250px
   * variant. A 20000x20000 PNG under 8 MB is an ordinary file, and this is the
   * only thing standing between one and a decoder. Twice what the app is asked
   * to produce.
   */
  maxPixelsPerSide: 4096,
  /**
   * Note what is absent, in both directions.
   *
   * `image/heic` cannot be here: the agent desk does not accept it at all, so
   * an unconverted iPhone photograph has to be transcoded on the device — which
   * the picker already does at the moment of choosing, where it is free.
   *
   * `image/gif` the desk would accept, and it is still absent: an animated
   * portrait is a decision nobody has made, and it forks the app into "first
   * frame or animation". Additive to allow later, subtractive to withdraw.
   */
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;
