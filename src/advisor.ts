import { z } from 'zod';

/**
 * The app's advisor slug — the id every other advisor-scoped route is keyed by
 * (`/v1/advisors/:advisorId/...`).
 *
 * Deliberately looser than the BFF's own guard, which additionally pins the
 * charset (`[A-Za-z0-9_-]{1,64}`). Tightening it here would be a silent
 * behaviour change for existing consumers: the app runs `safeParse` and drops a
 * mismatch quietly, so a stricter schema fails as "the feature does nothing"
 * rather than as an error. Align the two in a deliberate pass, not as a side
 * effect of adding a shape.
 */
/**
 * Формат идентификатора советника. Строгий намеренно: это значение приходит из
 * приложения в путь запроса, и сервер обязан отвергать всё, что не похоже на
 * ключ каталога, до похода в базу. Перенесено из BFF при объединении контрактов
 * (AURAT-0034): там проверка была именно такой, а здесь стояло `min(1)`, и
 * подключить пакет «как есть» значило бы ослабить валидацию на сервере.
 * Проверено на всех боевых идентификаторах — ужесточение никого не ломает.
 */
export const AdvisorId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, 'advisorId must be 1-64 chars of [A-Za-z0-9_-]');
export type AdvisorId = z.infer<typeof AdvisorId>;

/**
 * The categories the app filters the catalog by (`AURAD-0001`).
 *
 * There is no `DREAMS`: the catalog carries no dream reader, and keeping a chip
 * alive by inventing one is worse than dropping the chip. Values are uppercase,
 * matching `SessionStatus` — display labels are the app's business.
 */
export const AdvisorCategory = z.enum(['LOVE', 'TAROT', 'PSYCHIC']);
export type AdvisorCategory = z.infer<typeof AdvisorCategory>;

/**
 * One review of an advisor as the catalog serves it (`AURAT-0058`,
 * `AURAF-0014`). Written on the profile as monogram · name · stars · quote.
 *
 * No reviewer avatar and no tint: the disc is a monogram on a colour the app
 * derives from the name, which is a design token and has no business meaning
 * (`AURAT-0013` D6). No date either — the card does not show one, and a stored
 * date on a seeded review would age into a lie; `createdAt` orders the list and
 * nothing else.
 *
 * Where the rows come from is deliberately NOT on the wire. `source`
 * (`SEED`/`USER`), `published` and the session a review was left for are the
 * server's business: the client renders whatever it is handed, so a moderation
 * flag reaching the phone could only ever be a way to render something that
 * should not have been sent.
 */
export const AdvisorReview = z.object({
  id: z.string().min(1),
  /** First name as the reviewer gave it — never an account handle. */
  authorName: z.string().min(1),
  quote: z.string().min(1),
  /** Integer tenths, as `Advisor.ratingTenths`: `50` is five stars. */
  ratingTenths: z.number().int().min(0).max(50),
  createdAt: z.string().datetime(),
});
export type AdvisorReview = z.infer<typeof AdvisorReview>;

/**
 * An advisor persona as the catalog serves it (`AURAT-0013`,
 * `GET /v1/advisors`). Personas, never chatters: whoever actually answers is
 * never exposed (`AURAD-0001`).
 *
 * Two fields are absent by design. There is no `online` — liveness arrives
 * separately over the WS `presence.update` event, because a value baked into a
 * catalog response is stale the moment it is sent. And there is no avatar
 * *key*: the BFF stores an object key and composes `avatarUrl` from per-env
 * config (`AURAD-0005`), so re-bucketing never reaches the client.
 */
export const Advisor = z.object({
  id: AdvisorId,
  name: z.string(),
  /** Short professional line, e.g. "Psychic Reader · Medium". */
  role: z.string(),
  category: AdvisorCategory,
  /** One-line hook for list and profile headers. */
  tagline: z.string(),
  bio: z.string(),
  specialties: z.array(z.string()),
  /** Seeds the first message of a new thread with this persona. */
  greeting: z.string(),
  avatarUrl: z.string().url(),
  /**
   * USD cents per minute — the same figure the paid-session debit uses, so the
   * list and the booking sheet cannot disagree. Served regardless of
   * `billing_enabled`: the app shows a per-minute rate in v1 free chat too.
   */
  priceMinorPerMinute: z.number().int().positive(),
  /**
   * Integer tenths: `49` means 4.9. Same no-floats discipline as the money
   * fields — divide by 10 for display.
   *
   * Since `v0.15.0` this is an **aggregate over `reviews`**, not an owner-set
   * figure: `round(sum(ratingTenths) / reviewsCount)`. The change is invisible
   * on the wire and load-bearing on the screen — five reviews of whole stars
   * can only average to 4.0, 4.2, 4.4, 4.6, 4.8 or 5.0, so a hand-set "4.9 (5)"
   * is arithmetically impossible and checkable by anyone who cares to
   * (`AURAF-0014`).
   */
  ratingTenths: z.number().int().min(0).max(50),
  /** Number of published reviews — the length of `reviews`, not a bigger claim. */
  reviewsCount: z.number().int().nonnegative(),
  /**
   * The advisor's own reviews, in display order.
   *
   * Optional on the wire and always an array after parsing: a server that
   * predates `v0.15.0` (or one rolled back to it) still parses, and the app's
   * catalog load — which uses `parse`, not `safeParse`, so drift surfaces as a
   * retryable failure — does not turn into an empty screen over a field that
   * has a sane absence. No reviews means the app draws no reviews section.
   */
  reviews: z.array(AdvisorReview).default([]),
});
export type Advisor = z.infer<typeof Advisor>;

/**
 * Response of `GET /v1/advisors` — active advisors, already in display order.
 * An empty catalog is a valid `200`, not a `404`.
 */
export const AdvisorsResponse = z.object({
  advisors: z.array(Advisor),
});
export type AdvisorsResponse = z.infer<typeof AdvisorsResponse>;
