# @aura/contracts

Shared **Zod schemas + TypeScript types** for the boundary between the Aura mobile
app (`aura-app`) and the Aura BFF (`aura-bff`). One definition, imported by both —
so a change to the contract is a **compile-time break on both sides** instead of a
silent runtime drift (`AURAD-0006`).

Every schema is grounded in a ratified decision in the shared `aura-missus` brain
(`AURAI-0002`, `AURAD-0001/0002/0003`, `AURAF-0007`). This package holds the
**contract shapes only** — no business logic, no I/O. Deliberate exceptions:
`season-contrast` and `season-copy`, pure rules both sides must agree on — the
server refuses a season by them, the clients draw by them (see `v0.27.0`).

## What's inside

| Module | Shapes | Grounding |
|---|---|---|
| `money` | `Currency` (USD) | AURAD-0002 |
| `advisor` | `AdvisorId`, `Advisor`, `AdvisorReview`, `AdvisorCategory`, `AdvisorsResponse` | AURAD-0001, AURAT-0013, AURAF-0014 |
| `chat` | `Message`, `MessageDirection` (`user`/`advisor`/`system`), `MESSAGE_MARKERS`, `SendMessageRequest`, `HistoryQuery`/`HistoryResponse`, `WsServerEvent`, `MessagePushData` | AURAI-0002, AURAD-0001/0003, AURAF-0018, AURAF-0023 |
| `device` | `DeviceToken`, `RegisterDeviceRequest` | AURAF-0007-002 |
| `session` | `Session`, `SessionStatus`, `SessionFinishReason`, `SessionPricing`, `SessionInvite`, book/extend/finish/active requests + responses, `SessionResponse`, `SessionPriceDiscount`, `SESSION_DISCOUNT_KINDS`, `SESSION_PRICE_CHANGED` | AURAD-0002, AURAT-0008, AURAF-0013, AURAF-0020 |
| `wallet` | `WalletResponse`, `FirstSessionOffer`, `TopUpRequest`, `TopUpResponse`, `GooglePlayTopUpRequest`, `GooglePlayTopUpResponse`, `AppleTopUpRequest`, `AppleTopUpResponse` | AURAD-0002, AURAT-0007, AURAD-0010, AURAD-0017, AURAF-0017 |
| `envelope` | `ApiError` | AURAI-0002 |
| `profile` | `ProfileResponse`, `ProfilePatchRequest`, `Email`, `BirthDate` | AURAF-0015, AURAT-0063 |
| `tarot` | `TarotCard`, `TarotCardId`, `LocalDate`, `DailyCardQuery`, `DailyCardResponse`, `MarkDailyCardDrawnRequest` | AURAD-0012, AURAT-0049 |
| `account` | `AccountDeletionRefusalCode`, `ACCOUNT_DELETED` | AURAT-0042 |
| `promo` | `RedeemPromoCodeRequest`, `RedeemPromoCodeResponse`, `PromoCodeRefusalCode` | AURAF-0021, AURAT-0143, AURAF-0022, AURAT-0146 |
| `app-config` | `AppConfigResponse`, `AppConfigSeason`, `AppConfigPromo`, `AppConfigDiscount`, `AppConfigDisabledLanguages`, `SeasonPalette`, `HexColor`, `HEX_COLOR_PATTERN`, `SEASON_TOKENS`, `SEASON_EFFECTS` | AURAF-0022, AURAT-0147, AURAT-0150, AURAF-0023 |
| `language` | `LANGUAGES`, `Language`, `SOURCE_LANGUAGE`, `LANGUAGE_QUERY_PARAM`, `isLanguage` | AURAF-0023, AURAI-0010, AURAT-0168 |
| `season-copy` | `SeasonCopy`, `SEASON_COPY_KEYS`, `SEASON_COPY_LIMITS`, `SEASON_PLACEHOLDERS`, `SEASON_COPY_PLACEHOLDERS`, `fillSeasonCopy`, `formatSeasonAmount`, `seasonPlaceholdersIn` | AURAT-0147, SEASONAL.md |
| `season-contrast` | `SEASON_CONTRAST_PAIRS` (P1–P20), `checkSeasonPalette` (a partial palette too — the table of a draft), `seasonPalettePasses` (a whole palette, every pair), `contrastRatio` | AURAD-0022, AURAT-0150 |

Every shape mirrors a route the BFF actually serves. **Money is always an
integer of minor units** on the field that owns it (`balanceMinor`,
`costMinor`, `priceMinorPerMinute`, `amountMinor`) — no money object, no
floats. Session and wallet shapes were aligned to the as-built BFF in
`v0.3.0` (`AURAT-0010`); `presence.update` / `typing.update` in
`WsServerEvent` are forward contracts the BFF starts emitting in `AURAT-0009`.

`v0.29.0` translates **the advisor's labels** (`AURAF-0023`; BFF `AURAT-0173`).
`Advisor.role` and `Advisor.specialties` arrive in the request language
(`lang`), English by default — display text, no longer something to search for
English words in. `Advisor.topics` — the categories an advisor's specialties
read on (`AdvisorCategory[]`, no language, `[]` by default so a `v0.28` answer
still parses) — is what a client matches on instead. `TarotCard.name`'s JSDoc
now says it arrives in the request language too (`AURAT-0171`). Additive only.

`v0.28.0` adds **the language on the wire** (`AURAF-0023`; BFF `AURAT-0168`,
app `AURAT-0169`, web `AURAT-0170`, tarot deck `AURAT-0171`). `LANGUAGES` — the
24 codes both clients ship (en + the other 23 official EU languages), with
`isLanguage` (exact match, no normalisation) and `SOURCE_LANGUAGE` (`en`). A
client states its language as `?lang=` (`LANGUAGE_QUERY_PARAM`) on JSON requests
and uploads — not on picture or attachment addresses, not on the socket; an
unknown or switched-off value is answered in English, never a `400`.
`Message.marker` — on a `system` message that is a session marker,
`session_started` / `session_finished` (`MESSAGE_MARKERS`), a plain string so a
later marker does not break parsing; it wins over the English `content`, which
stays for older clients. `AppConfigResponse.disabledLanguages` — the operator's
switch for a translation that shipped wrong (`AppConfigDisabledLanguages`, plain
strings, `[]` by default so a `v0.27` answer still parses). Additive only.

`v0.27.0` adds **seasonal campaigns** (`AURAF-0022`; BFF `AURAT-0147`, app
`AURAT-0148`, web `AURAT-0149`, design `AURAT-0150` / `SEASONAL.md`).
`GET /v1/app-config` — public, no token, `ETag`/`304`, one minute of cache —
returns `AppConfigResponse` `{season, promo, discount}`, each `null` or what is
in effect now with its own `endsAt`. A season is a full **palette of 17 tokens**
(`SeasonPalette`, `#RRGGBB`), two pictures (`art.hero`, `art.ticket`, absolute
URLs never overwritten in place), **nine texts** (`SeasonCopy`: hero title, body
with and without a code, button, the code ticket's and the discount ticket's
lines) and an effect. Texts arrive with placeholders unfilled — `{code}` and
`{amount}` from `promo` (`code`, `amountMinor`), `{pct}` from `discount` — and
`fillSeasonCopy` / `formatSeasonAmount` fill them the way the server measured
them against `SEASON_COPY_LIMITS`; `SEASON_COPY_PLACEHOLDERS` says which a text
may use (only those that always have a value where it shows). `preset` and
`effect` are plain strings so a value a released client does not know cannot
break the parse; an unknown preset is drawn from its palette, an unknown effect
is no effect. `promo` and `discount` are `null` while billing is off;
`discount` is display only. `season-contrast` holds the rule a palette passes
before the backoffice lets it go live — WCAG ratios for pairs P1–P18 of the
brief and P19–P20 (ink and teal-ink on the ticket body) (text ≥ 4.5, the button
edge ≥ 3, `#FFFFFF@0.70` composited over its ground) — so the
clients can re-check with the same code. Whitelist, pairs, keys and limits
change only through a new minor version. `SessionPricing.blocks[].discount`
(optional, `{kind, pct, label}` or `null`; `kind` a string, known values in
`SESSION_DISCOUNT_KINDS`) says whose discount `creditMinor` is: the server
takes the bigger of the first-session offer and a campaign, never both, a tie
going to the campaign. `BookSessionRequest.expectedCostMinor` (optional) is the
price the client showed; if the booking's own price differs, nothing is charged
and the answer is 409 with `code` `SESSION_PRICE_CHANGED` (`session_price_changed`). Additive only.

`v0.26.0` documents **public promo codes** (`AURAF-0022`; BFF `AURAT-0146`):
one code an operator names for a campaign (`WINTER5`), redeemed once by every
account, on the same route with the same shapes. No schema changes — clients
built against `v0.25.0` handle public codes as they are: the server reads any
4–20 letters and digits, entering a public code again is a `200` with
`replayed: true`, and `promo_code_already_used` / `promo_code_campaign_used`
are never sent for one. Documentation only.

`v0.25.0` adds **promo codes** (`AURAF-0021`; BFF `AURAT-0143`, app `AURAT-0144`,
web `AURAT-0145`): `POST /v1/wallet/promo-codes/redeem` with `{code}` — the code
as typed, normalised by the server, and only ever in the body because URLs are
logged. `200` `RedeemPromoCodeResponse` `{entryId, balanceMinor, currency,
creditedMinor, replayed}` — the Play response's shape; `replayed: true` is this
account redeeming its own code again, never a second credit. Refusals are `409`
with a `PromoCodeRefusalCode`, except `promo_code_too_many_attempts`, which is
`429` with `Retry-After`. No amount on the wire: the credit is the batch's.
Additive only.

`v0.24.0` adds the **question to the advisor** (`AURAF-0020-028`; BFF
`AURAT-0122`, web `AURAT-0121`): `BookSessionRequest.question` — optional, at
most 250 characters after trimming, empty or whitespace-only meaning no
question — travels with the booking to the desk, and `Session.question` returns
it (`string | null`). `question` is optional on the wire and always
`string | null` after parsing — a server that predates this version still
satisfies the schema. A replayed booking keeps the original question. Additive
only.

`v0.23.0` adds **one session by id** (`AURAF-0020`; BFF `AURAT-0111`, web
`AURAT-0110`): `SessionResponse` `{session}` for `GET /v1/sessions/:sessionId` —
someone else's session and a missing one are the same 404. It also writes down
the replay rule of `AURAT-0109`: a repeated booking key answers with the
original session before the request is checked, body not compared; a repeated
extend key does the same, but other `minutes` under it is 409. The comment on
`EnsureConversationResponse` now names the real verb, `PUT`. Additive only.

`v0.22.0` adds **message deletion** (`AURAF-0018`; app half `AURAT-0097`, BFF
half `AURAT-0098`): when the desk deletes a message of either side, the BFF
emits the WebSocket event `message.deleted` `{advisorId, messageId}` and stops
returning the message from history. Deletions missed off the socket are caught
up through `HistoryQuery.deletedFrom` (a message id) → `HistoryResponse.deletedIds`
(ids of deleted messages at or after it, `[]` by default). `Message` and
`MessagePushData` are unchanged. Additive only.

`v0.21.0` adds the **first-session offer** (`AURAF-0017`; app half `AURAT-0093`,
BFF half `AURAT-0094`): `WalletResponse.firstSessionOffer` — `{active, pct}`,
optional — tells the app before booking whether the user's first paid session
is discounted. The discount itself travels where the flat $5 credit did,
`SessionPricing.blocks[].creditMinor`, now documented as `subtotal − cost`.
Additive only.

`v0.20.0` adds the **StoreKit top-up rail** (`AURAD-0017`; app half `AURAT-0081`,
BFF half `AURAT-0082`): `POST /v1/wallet/top-ups/apple` with
`{transactionId, productId}` — the Play claim with Apple's id in place of
Google's token. No JWS on the wire: the BFF asks the App Store Server API by id
rather than trusting a signature the app hands it. The response is the Play
response under its own name. Additive only.

`v0.19.0` adds **account deletion** (`AURAT-0042`, BFF half in `aura-bff-manor`):
`DELETE /v1/me` answers `204` — and `204` again on a repeat — or `409` with
`account_has_live_sessions` while a paid session is booked or running. There is
no request or response body, so the release is two names: the refusal code, and
`ACCOUNT_DELETED`, the `ApiError.code` every other route answers `401` with (and
the WebSocket close reason) while a device still holds a token for the deleted
identity. The distinction from a plain `401` is the point: an expired token is
refreshed and retried, a deleted account is signed out. Additive only.

`v0.16.0` adds the **user profile** (`AURAF-0015`, BFF half `AURAT-0063`, app
half `AURAT-0062`): `GET /v1/me` and `PATCH /v1/me` carrying `displayName`,
`email`, `birthDate` and `marketingOptIn` beside the read-only `phoneE164`.
Until now the app had nowhere to put a name — it showed a compiled-in `'Vasya'`
— and the birth-date write from the horoscope sheet answered `404`.

Three shapes here are worth reading before they are "tidied up":

- **The read is looser than the write.** `ProfileResponse` holds plain nullable
  strings; only `ProfilePatchRequest` applies `Email` and `BirthDate`. A value
  stored before a rule tightened must not be able to fail the read and take the
  rest of the profile with it.
- **`""` erases the email, exactly like `null`.** That is what a cleared text
  field sends, and refusing it would make "delete my email" a `400`.
- **`phoneE164` is declared in the patch only to be refused by name.**
  `.strict()` alone would call it an unrecognized key, when the real answer is
  that the number comes from the verified sign-in token.

`birthDate` is a calendar day (`YYYY-MM-DD`, a day that exists, not before
1900) and deliberately carries **no** future bound: which "today" applies
depends on whether the device's clock or the server's is asked, and the two
differ by up to a day. Each side adds its own. Additive only.

`v0.15.0` adds **advisor reviews** (`AURAF-0014`, BFF half `AURAT-0058`, app
half `AURAT-0059`): `AdvisorReview` and `Advisor.reviews`, so the quotes on the
profile stop being two strings compiled into the app and shown for every
persona. `reviews` is optional on the wire and always an array after parsing —
a server that predates this version still satisfies the schema, and no reviews
means the app draws no reviews section.

The same release changes what `ratingTenths` and `reviewsCount` **mean**,
without changing their shape: they are now aggregates over `reviews` rather
than owner-set display figures. The reason is arithmetic, not tidiness — five
reviews of whole stars can only average to 4.0, 4.2, 4.4, 4.6, 4.8 or 5.0, so a
hand-set "4.9 (5)" is impossible and checkable in the head by anyone looking at
the screen. Additive.

`v0.14.0` adds the **paid session invitation** (`AURAF-0013`, BFF half
`AURAT-0054`, app half `AURAT-0055`): `Message.sessionInvite`, an optional
**empty object** whose presence says this message invited the reader into a paid
private session. It carries no duration and no price — the booking sheet the
button opens names both, and a price typed by a chatter is a price that can be
mistyped. An object rather than a boolean so `minutes` can be added additively
if the duration decision is ever revisited. Additive only.

`v0.12.0` adds the **daily tarot card** (`AURAD-0012`, BFF half `AURAT-0049`):
the deck of 78 cards and the day's draw move to the server, replacing the seven
cards the app had compiled in. The client sends its IANA zone and nothing else
about time — the server reads its own clock in that zone, records the draw
against `(user, localDate)`, and avoids cards that fell for the same user in the
last two weeks. `imageUrl` arrives composed, as `Advisor.avatarUrl` does.
Additive only.

`v0.7.0` adds the **Google Play top-up rail** (`AURAD-0010`, app half
`AURAT-0026`, BFF half `AURAT-0027`): `POST /v1/wallet/top-ups/google` takes a
Play purchase token and credits the wallet only after the BFF has verified it
with Google. The request carries **no amount** — the credit comes from the
BFF's own tier table keyed by `productId`, because a client that names its own
credit is a client that mints balance. Additive only.

`v0.4.0` adds the **advisor catalog** (`AURAT-0013`): the BFF now serves
personas from Postgres at `GET /v1/advisors`, replacing the hardcoded
`ADVISORS` array the app shipped while there was no backend for them. Additive
only — no existing shape changed.

## Consuming it (git dependency — no registry publish)

Add to `aura-bff` / `aura-app` `package.json`, pinned to a tag or commit:

```jsonc
{
  "dependencies": {
    "@aura/contracts": "git+ssh://git@github.com/RomSribn/aura-contracts.git#v0.4.0"
  }
}
```

On install, npm runs the `prepare` script (builds `dist/` with tsup), so consumers
get compiled ESM + CJS + `.d.ts` without a registry.

```ts
import { Message, SendMessageRequest, type Session } from '@aura/contracts';

const parsed = SendMessageRequest.parse(body); // validate at the edge
```

## zod version

`zod` is a **peerDependency** (`^3.23.0`) so the consumer's single zod instance is
used. **Keep the zod major aligned** across `aura-app`, `aura-bff`, and this
package — schemas from different zod majors do not interoperate. (If the app moves
to zod 4, bump the peer range here in lockstep.)

## Develop

```bash
npm install
npm run build      # tsup -> dist (esm + cjs + dts)
npm run typecheck
```

## Versioning

SemVer via git tags (`v0.1.0`, …). A breaking shape change = major bump; consumers
pin a tag and upgrade deliberately. Branch: `main`.
