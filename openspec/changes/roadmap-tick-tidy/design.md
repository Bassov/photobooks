## Decisions

1. Close `worker-ctx-trim` with `pnpm roadmap done` (not a hand edit). Its docs part merged in #397. Its deferred rig part (compact preflight card) merged as `rig-bump-0-2-21`, and preflight now prints that card.
2. Tick the index once with `pnpm roadmap sync`, which ticks every item whose file says `Status: done`. Audit (2026-11-04): 80 `[x]` lines, all with `Status: done`. 35 `[ ]` lines, of which only `roadmap-index-no-tick` (done) and `worker-ctx-trim` (merged, file not closed) are off.
3. Drift guard: no CLI change. `check` already warns `sync: <slug> is Status: done but index still open`. Making that an error would fail every item PR, which leaves the index alone by design (#435). The CLI also lives in `@albasov/ts-agent-rig`, outside this lane.
4. The `text-blocks` / `live-captions` item files do not say they are superseded by text-frames. They stay open and are listed for the Owner audit in the PR body.

## Touch-set & Test Plan

| Path                                    | Reason                                               |
| --------------------------------------- | ---------------------------------------------------- |
| `docs/roadmap.md`                       | `roadmap sync` ticks two lines                       |
| `docs/roadmap/P2/worker-ctx-trim.md`    | `Status: done` + Scope ticks                         |
| `docs/roadmap/P2/roadmap-tick-tidy.md`  | item scope filled from the brief; closed at finalize |
| `openspec/changes/roadmap-tick-tidy/**` | plan artifacts                                       |

- Reuse: `pnpm roadmap done` / `sync` / `check`.
- Tests: none (no CLI or `src/` change); acceptance is `pnpm roadmap check` exit 0 with no `sync:` warning for these two slugs.
