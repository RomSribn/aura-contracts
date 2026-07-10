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
| `money` | `Currency` (USD), `Money` (integer cents) | AURAD-0002 |
| `advisor` | `AdvisorId`, `Advisor` (persona) | AURAD-0001 |
| `chat` | `Message`, `MessageDirection`, `AdvisorPresence`, `SendMessageRequest` | AURAI-0002, AURAD-0001/0003 |
| `session` | `PaidSession`, `SessionStatus` — *v0, `AURAT-0008` owns final* | AURAD-0002 |
| `wallet` | `Wallet` — *v0, `AURAT-0007` owns final* | AURAD-0002 |
| `envelope` | `ApiError` | AURAI-0002 |

Message/session/wallet shapes marked *v0* are deliberately minimal starting points;
the owning `AURAT-*` task refines them. Chat primitives (`Message`, presence) are
stable.

## Consuming it (git dependency — no registry publish)

Add to `aura-bff` / `aura-app` `package.json`, pinned to a tag or commit:

```jsonc
{
  "dependencies": {
    "@aura/contracts": "git+ssh://git@github.com/RomSribn/aura-contracts.git#v0.1.0"
  }
}
```

On install, npm runs the `prepare` script (builds `dist/` with tsup), so consumers
get compiled ESM + CJS + `.d.ts` without a registry.

```ts
import { Message, SendMessageRequest, type Advisor } from '@aura/contracts';

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
