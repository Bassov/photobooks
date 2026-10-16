# Tasks

## Prior shipped (keep checked)

- [x] 1.1–1.2 SessionState recents + active ids + adapters
- [x] 2.1–2.2 projectSession surface + open from home
- [x] 3.2 Playwright empty/happy/overflow home (baseline)

## Review hardening (≤8)

- [x] 5.1 Recents: `peekLibraryHandle`; `isSameEntry` dedup via peek; bump only on success; `runReadwrite` IDB txn; cap 10; `removeRecentLibrary`; reserved-key rejection — verify unit + contract
- [x] 5.2 Restore: notify surface; loading until settle; failed restore clears stale ids; read `__active` to preselect — verify restore-failure unit
- [x] 5.3 Re-grant: pending book; `requestPermission` first; picker + `isSameEntry`; Don't Allow message — verify re-grant unit
- [x] 5.4 New library while open: release first; no book copy; clean editor + new filmstrip; busy serialize without focus steal — verify unit
- [x] 5.5 Home UI: error+retry; permission hint+Grant; Home chrome control; human-readable errors; test hooks DEV/`VITE_E2E` only — verify smoke + e2e Home button
- [x] 5.6 E2e: Home → home; same-folder reopen no duplicate; IDB-blocked deferred to `recents-home-quality` when fixture is cheap — verify Home + dedup cases
- [x] 5.7 Docs: roadmap `recents-home-quality` follow-up; naming `__recents`/`__active`; PR Manual scenarios — verify files updated
- [x] 5.8 `pnpm verify:fast` green on touched paths before push

## 4. Verification checklist

- [x] pnpm typecheck — green (`pnpm verify:fast`)
- [x] pnpm lint — green
- [x] pnpm test — green
- [x] pnpm test:e2e (or pnpm verify) — `e2e/recents-home.spec.ts` 5/5 (empty, happy, Home button, dedup, overflow)
- [x] pnpm stryker:diff — 85.36 (≥60); survivors mostly equivalent parse/label branches in `recents.ts` / permission paths under contract
- [x] pnpm test:lhci — N/A here (deferred to `recents-home-quality`)
- [x] UI in scope: empty/happy/Home/overflow covered by Playwright; permission hint + error panel in HomeScreen; full ui-review a11y polish in `recents-home-quality`
- [x] Docs/rules sync: roadmap `recents-home-quality`; design `__recents`/`__active`
- [x] pnpm audit:ci — N/A (no deps)
- [x] Launch openspec-proposal-reviewer then openspec-design-reviewer; resolve before apply
- [x] Launch `openspec-implementation-reviewer`; highs fixed (bump-after-success, load-fail clear, Don't Allow/mismatch tests); re-check before push
- [x] Manual check: see below (folder-picker items still need operator pass on preview)
- [x] High-risk security surface: Security Review — no medium+ (FSA re-grant / peek / reserved keys / VITE_E2E gating)

## Manual test scenarios

Automated lock-in: empty home; Home button + reload stays home; same-folder dedup; happy open-from-home; home-scroll overflow (`e2e/recents-home.spec.ts`).

Operator folder-picker (preview URL):

1. Cold start, cleared site data → empty home.
2. Create library + book, place photos → F5 returns to the book.
3. Home button → home; reload stays on home.
4. Close tab → new tab → recent → same book opens with photos.
5. Second library ordering; reopen same folder → no duplicate.
6. Open book locked in another tab → readable message; recents order unchanged.
7. Don't Allow on permission → message.
8. Narrow window (~900px). Keyboard-only polish deferred to `recents-home-quality`.
