# finalize-reliability

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item finalize-reliability
Status: done

## Scope

Owner 2026-11-15 (worker-efficiency item 2): `pnpm agent finalize` fails too often; keep every check. Rig-side fix in `Bassov/ts-agent-rig` (`fix/finalize-reliability`, v0.2.23); this repo carries only this item. No `@albasov/ts-agent-rig` bump here (relaunch after the release), no workflow change (no reusable workflow touched), no `docs/agent-loop.md` edit (#619).

- [x] Measured cause from 171 worker finalize calls (Nov 4–14, 0 ok): self-check `evidence` failed on change dirs other items left on main (98 + 24 with ratchet findings + 3 with a stale NoCoverage report), delta-sync 19, dirty tree 26, worker killed 1; no stage ever timed out (median 18 s, max 75 s vs 15–60 min Bash timeouts)
- [x] Rig: self-check scopes `evidence` to the item + change dirs the branch touches and `disables` to NoCoverage in changed files (`file:line mutator`); finalize checks the item's own ticks before archive
- [x] Rig: finalize caches passed check stages per HEAD / origin/main / ratchet base / branch / Stryker report, passes the pre-push hook's fork-point `GATE_RATCHET_BASE` + `PR_POLICY_BRANCH`, caps each stage at 10 min and prints one `FAIL <stage>: <cause> — … rerun: …` line
- [x] Rig: replay tests over 6 real failed runs (`testdata/finalize-cases/`, `src/finalize-replay.test.mjs`), version 0.2.23, rig PR opened (not merged, not tagged)
- **Done when:** rig tests pass; the replays show no timeout, a rerun on the same HEAD skips passed stages and each coverage / mutation miss gives one actionable line; rig PR and this PR link each other; expected effect after release: finalize fail rate ≤25 % and no timeouts over the next 20 runs.
- **Browser check:** N/A (agent tooling, no UI).
