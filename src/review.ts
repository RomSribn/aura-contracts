import { z } from 'zod';

import { AdvisorId } from './advisor';

/**
 * Leaving a review (`AURAF-0016`, BFF half `AURAT-0067`, app half
 * `AURAT-0066`): `PUT /v1/advisors/:advisorId/review` and
 * `GET /v1/reviews/me`.
 *
 * The product rule the shapes here exist to serve — the "two speeds" of
 * `REVIEWS.md` §0: **the star publishes at once** and counts toward the
 * advisor's rating, while **the written text is read by a person first** and,
 * if declined, simply never appears. Nothing in this file lets the app find
 * out which happened. That is deliberate and is the whole of §5: an app that
 * can tell `PENDING` from `DECLINED` is an app that will one day draw the
 * difference, and a normal 24-hour wait would start reading as a rejection.
 *
 * How the review that came *back* is shaped is not here — a published review
 * is `AdvisorReview` inside the catalog, and it says nothing about who wrote
 * it or how it got there.
 */

/**
 * Long enough for a real account of a reading, short enough that the profile
 * stays a list of impressions rather than a forum. The counter on the form
 * turns coral at 40 remaining.
 */
export const REVIEW_MAX_TEXT_LENGTH = 400;

/**
 * Ratings are whole stars, carried in the same integer tenths as every other
 * rating in the contract: `10` … `50`, nothing in between. Half-stars would
 * average into figures no one can check by hand, which is exactly what
 * `AURAF-0014` spent a task removing.
 */
export const REVIEW_RATING_STEP = 10;
export const MIN_REVIEW_RATING_TENTHS = 10;
export const MAX_REVIEW_RATING_TENTHS = 50;

/** A whole number of stars, expressed in tenths. */
export const ReviewRatingTenths = z
  .number()
  .int()
  .min(MIN_REVIEW_RATING_TENTHS)
  .max(MAX_REVIEW_RATING_TENTHS)
  .refine(
    tenths => tenths % REVIEW_RATING_STEP === 0,
    `ratingTenths must be a whole number of stars (a multiple of ${REVIEW_RATING_STEP})`,
  );

/**
 * What the form sends. `PUT`, not `POST`, and the reason is the rule: there is
 * **one review per person per advisor**, so a second submission edits the
 * first. That also makes a retry after a lost response harmless — the app has
 * no edit screen, and the idempotence is there for the network, not for a
 * feature.
 */
export const SubmitReviewRequest = z.object({
  ratingTenths: ReviewRatingTenths,
  /**
   * Genuinely optional: stars alone are a valid review, and `''` is what the
   * form sends when the person wrote nothing.
   */
  text: z.string().max(REVIEW_MAX_TEXT_LENGTH),
  /** Publishes the byline as "Anonymous · Verified client". */
  anonymous: z.boolean(),
  /**
   * The session that prompted the review, when one did (the row in
   * Sessions → Past). Informational — a review belongs to an advisor, not to a
   * session, and nothing keys on this.
   */
  sessionId: z.string().min(1).optional(),
});
export type SubmitReviewRequest = z.infer<typeof SubmitReviewRequest>;

/**
 * The person's own review of one advisor — what the app needs to know to draw
 * the "already reviewed" state at all three entry points.
 *
 * `hasText` says the person wrote something. It is **not** a moderation
 * status, and there is no field that is: see the note at the top of this file.
 */
export const MyReview = z.object({
  advisorId: AdvisorId,
  ratingTenths: ReviewRatingTenths,
  anonymous: z.boolean(),
  hasText: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MyReview = z.infer<typeof MyReview>;

/**
 * Response of `GET /v1/reviews/me` — every review this person has left, one
 * per advisor. Loaded once per session like the catalog: three entry points in
 * three tabs each need the answer synchronously, and an empty list is the
 * ordinary state.
 */
export const MyReviewsResponse = z.object({
  reviews: z.array(MyReview),
});
export type MyReviewsResponse = z.infer<typeof MyReviewsResponse>;

/** Response of `PUT /v1/advisors/:advisorId/review` — the stored review. */
export const SubmitReviewResponse = z.object({
  review: MyReview,
});
export type SubmitReviewResponse = z.infer<typeof SubmitReviewResponse>;

/**
 * Named in `ApiError.code` when a submission is refused for good.
 *
 * Same meaning as `SendRefusalCode` and `AvatarRefusalCode`: do not offer a
 * retry, because the same request will be refused again. A review needs a
 * conversation with that advisor in which the person actually said something —
 * the client hides the link when there is none, and the server refuses anyway,
 * because "Verified client" is only true while something checks it.
 */
export const ReviewRefusalCode = z.enum([
  /** No conversation with this advisor, or none the person has written in. HTTP 403. */
  'review_not_eligible',
]);
export type ReviewRefusalCode = z.infer<typeof ReviewRefusalCode>;
