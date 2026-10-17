# Tasks

## 1. Reveal settle

- [x] 1.1 Reveal path: keep `content-visibility` forced for the pending reveal; plan retries via `planRevealAttempt` (ceiling 64, `*2` at max scroll) with paint double-rAF confirm; on exhaustion clear pending reveal — verify with a failing-then-passing public Pasteboard unit case for second-nudge success
- [x] 1.2 Public unit case: after ceiling exhaustion, pending reveal is cleared (no further scroll fights) — verify in `SpreadTemplateBar.test.tsx` or co-located Pasteboard tests via Add spread + stubbed boxes

## 2. E2E reliability

- [x] 2.1 Keep strict `spreadViewContained` in `e2e/spread-view.spec.ts` “add spread keeps the fitted zoom…”; add a deterministic settle wait only if still needed and never loosen overlap/tolerances/retries/skip/helpers — verify the assertion text and helper call remain
- [x] 2.2 Prove locally: `pnpm exec playwright test e2e/spread-view.spec.ts -g "add spread keeps the fitted zoom" --repeat-each=50` is 50/50 green — record the command result under this task when ticking
  - Evidence: `node scripts/with-playwright-env.mjs pnpm exec playwright test e2e/spread-view.spec.ts -g "add spread keeps the fitted zoom" --repeat-each=50` → **50 passed** (also 50/50 with `--workers=1`)

## 3. Roadmap scope

- [x] 3.1 Tick matching scope checkboxes in `docs/roadmap/M2.1/add-spread-reveal-flake.md` as each item lands — verify scope boxes match shipped behavior before archive

## Verification

- [x] pnpm typecheck — via `pnpm verify:fast:quiet` (green)
- [x] pnpm lint — via `pnpm verify:fast:quiet` (green)
- [x] pnpm test — `pnpm verify:fast:quiet` → 886 passed
- [x] pnpm test:e2e (or pnpm verify) — `e2e/spread-view.spec.ts` 12/12; target test green; prior `--repeat-each=50` → 50/50
- [x] pnpm stryker:diff — **72.49%** (pasteboardReveal.ts 70.68%, pasteboardCameraFit.ts 95.00%); threshold 60
  - Survivors (non-behavior / intentional 1px band):
    - pasteboardReveal contain/nudge `±1` Equality/Arithmetic on port edges — same 1px tolerance band used by e2e `spreadViewContained`; flipping `+1`↔`-1` or `>=`↔`>` does not change product containment at integer CSS pixels
    - pasteboardReveal ConditionalExpression/BlockStatement on secondary nudge branches — equivalent empty/redundant paths after primary nudge already centered the box in unit stubs
    - pasteboardCameraFit `shouldApplyDelayedFitZoom` EqualityOperator on `1e-9` epsilon — float compare band; exact equality at committed zoom correctly refuses zoom-out
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no visual chrome/bundle surface change; reliability-only)
- [x] UI in scope: browser smoke evidenced — e2e `spread-view` fitted add-spread path uses `assertDocumentFitsViewport` + `assertNamedScrollport('pasteboard-scroll')` (empty/happy/scroll); skill `ui-review` pass: no new branded UI; a11y controls unchanged (Add spread / Fit); layout smoke covered by those e2e asserts
- [x] Docs/rules sync — roadmap scope boxes ticked; AGENTS/README unchanged (no module-map/command change beyond existing editor paths); stryker.mutate.md reasons added for Pasteboard / usePasteboardReveal wiring excludes
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dependency changes; not security-tagged)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — pass agent `eea124d0-6cd7-4189-aabc-a0934f3086f7` (after design/proposal amend)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass agent `cd80e87e-7c23-4388-bf00-0383e7d86cc9`
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — N/A (prep flake; no security surface)

## Manual test scenarios

1. `pnpm exec vite --host 127.0.0.1 --port 5173` → Home → **Start editing** → editor shell visible.
2. **Fit spread** → wait until slot-0 spread fills pasteboard (≥90% height, contained) → zoom indicator stable (observed **39%**).
3. **Add spread** → within 15s slot-3 spread fully inside `pasteboard-scroll` (`contained: true`); zoom still **39%**; `spreadCount` 4; document fits viewport (`docFit: true`); scrollTop advanced to reveal new spread (~1533).

Observed: all steps pass (Cursor browser MCP + CDP evaluate). Matches e2e lock-in.
