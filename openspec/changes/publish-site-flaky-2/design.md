## Decisions

1. `inPool(items, limit, prepare, run)`: `prepare` (signing, no request) runs `limit` items ahead of the window; the first `limit` items are all prepared before any starts, then start in the same macrotask. Item `k` still starts only once item `k - limit` settled and no item failed (#582).
2. `send` splits into `sign` + `sendSigned(request, signed, missingIsOk)`: the first try uses the pre-signed request and `attempt` reaches `fetch` with no await before it; a retry after a 503 / timeout signs anew after its wait. GET of the manifest and the manifest PUT keep `send` (sign, then send).
3. A prepared item that never starts (run stopped) has its rejection handled at creation, so a stop never leaves an unhandled rejection. `crypto.subtle` settles on its own macrotask, which is why signing inside the slot let a reply land first.

## Touch-set & Test Plan

| Path                              | Why                               |
| --------------------------------- | --------------------------------- |
| `src/publish/publishSite.ts`      | sign-ahead pool, `sendSigned`     |
| `src/publish/publishSite.test.ts` | new PBT, existing tests unchanged |

- Reuse: `createFakeR2` override + `events` (no helper change).
- Tests: PBT over 4–9 assets with held replies released in start order: 4 on the wire whenever ≥4 left, and 4 already on the wire at the first reply. Existing P4 / #582 / reply-order PBT unchanged. Loop evidence: P4 test 300/300, alone and with a parallel loop.
