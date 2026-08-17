# @aura/contracts

Shared **Zod schemas + TypeScript types** for the boundary between the Aura mobile
app (`aura-app`) and the Aura BFF (`aura-bff`). One definition, imported by both —
so a change to the contract is a **compile-time break on both sides** instead of a
silent runtime drift (`AURAD-0006`).

Every schema is grounded in a ratified decision in the shared `aura-missus` brain
(`AURAI-0002`, `AURAD-0001/0002/0003`, `AURAF-0007`). This package holds the
**contract shapes only** — no business logic, no I/O.

## What's inside

| Module | Shapes | Grounding |
|---|---|---|
| `money` | `Currency` (USD) | AURAD-0002 |
| `advisor` | `AdvisorId`, `Advisor`, `AdvisorCategory`, `AdvisorsResponse` | AURAD-0001, AURAT-0013 |
| `chat` | `Message`, `MessageDirection` (`user`/`advisor`/`system`), `SendMessageRequest`, `HistoryQuery`/`HistoryResponse`, `WsServerEvent`, `MessagePushData` | AURAI-0002, AURAD-0001/0003 |
| `device` | `DeviceToken`, `RegisterDeviceRequest` | AURAF-0007-002 |
| `session` | `Session`, `SessionStatus`, `SessionFinishReason`, `SessionPricing`, book/extend/finish/active requests + responses | AURAD-0002, AURAT-0008 |
| `wallet` | `WalletResponse`, `TopUpRequest`, `TopUpResponse`, `GooglePlayTopUpRequest`, `GooglePlayTopUpResponse` | AURAD-0002, AURAT-0007, AURAD-0010 |
| `envelope` | `ApiError` | AURAI-0002 |

Every shape mirrors a route the BFF actually serves. **Money is always an
integer of minor units** on the field that owns it (`balanceMinor`,
`costMinor`, `priceMinorPerMinute`, `amountMinor`) — no money object, no
floats. Session and wallet shapes were aligned to the as-built BFF in
`v0.3.0` (`AURAT-0010`); `presence.update` / `typing.update` in
`WsServerEvent` are forward contracts the BFF starts emitting in `AURAT-0009`.

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
