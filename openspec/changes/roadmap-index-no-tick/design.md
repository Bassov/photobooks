## Decisions

1. Photobooks-side, no rig bump. Rig v0.2.21 `done` / `next` / `check` / `agent finalize` already behave right (file `Status: done` is read as done; a pending tick is a `check` warning; finalize skips `sync`). Only our docs tell item PRs to run `sync`.
2. Migration = one `pnpm roadmap sync` in this PR (8 file-done lines incl. `locked-frame-swap`). All 71 ticked lines already have `Status: done` in their files, so the file is SoT everywhere; un-ticking would only add 79 "run roadmap sync" warnings. After this PR `sync` is Owner-side on `main` (with `archive <M>`), never in an item PR. The index header (rig `INDEX_NOTE`) is left as generated; RULES.md carries the rule.
3. A CLI contract test in `scripts/` fails a future rig bump that re-adds an index tick.

## Touch-set & Test Plan

| File                                       | Why                                                        |
| ------------------------------------------ | ---------------------------------------------------------- |
| `openspec/config.yaml`                     | `operations.archive` line 92: drop `sync` / own index tick |
| `docs/roadmap/RULES.md`                    | lines 30-31 rewrite, line 60 sentence deleted              |
| `.claude/skills/roadmap/SKILL.md`          | Close: no `sync`, no tick-conflict merge                   |
| `docs/agent-loop.md`                       | lines 88, 133, 157: no `sync`                              |
| `docs/roadmap.md`                          | one-time `sync`                                            |
| `docs/roadmap/P2/roadmap-index-no-tick.md` | stub filled; `Status: done`                                |
| `scripts/roadmap-done.test.mjs`            | new CLI contract test                                      |

- Reuse: rig `roadmap` bin with `--root <fixture> --json`.
- Tests (unit): temp fixture; `done` leaves the index bytes equal and sets `Status: done`; `next` skips that item while its line is still `[ ]`; `check` exits 0 with a `sync:` warning. No PBT / e2e (no UI, no `src/`).
