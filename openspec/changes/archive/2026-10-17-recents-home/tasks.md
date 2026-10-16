# Tasks

## Prior shipped (keep checked)

- [x] 1.1–1.2 SessionState recents + active ids + adapters
- [x] 2.1–2.2 projectSession surface + open from home
- [x] 3.2 Playwright empty/happy/overflow home (baseline)
- [x] 5.1–5.3, 5.5–5.8 Prior hardening (peek/dedup/re-grant/UI/e2e/docs/verify)

## Merge-blocker round (≤8)

- [x] 6.1 Home resets document + assets; no foreign adopt on Open/New/re-grant after Home — verify failing-then-passing unit + e2e Home→Open other library
- [x] 6.2 Flush pending save before lock release; error-phase blocks leave — verify flush-on-Home / New library / gesture-deferred / error-phase unit
- [x] 6.3 New library: pick first; cancel leaves book+lock — verify unit (picker stub)
- [x] 6.4 Remember failure after activate → rollback (no leaked lock) + homeError; same for openBookFromHome — verify unit
- [x] 6.5 tryRestore under busy / editor actions disabled while restorePending; locked-elsewhere home clears accessPhase — verify unit
- [x] 6.6 HomeScreen: drop listbox/aria-selected; keep aria-current; loading has no interactive buttons — verify minimal HomeScreen.test.tsx
- [x] 6.7 Soften specs (focus/IDB-throw/single-txn); honest Stryker note; expand `recents-home-quality` + book-titles roadmap; Manual scenarios — verify docs
- [x] 6.8 `pnpm verify:fast` + e2e green; implementation review; re-archive; push; CI green

### Stryker note (honest)

Survivors after `pnpm stryker:diff` live in `src/project/session/browserSessionState.ts` (approx. lines 57, 67, 71, 127, 137) and include real gaps (error/path handling), not merely “equivalent parse/label branches in `recents.ts`”. Full kill / reserved-key mutation coverage → `recents-home-quality`.

## 4. Verification checklist

- [x] pnpm typecheck — green (`pnpm verify:fast`)
- [x] pnpm lint — green
- [x] pnpm test — green (regression tests fail before fix, pass after)
- [x] pnpm test:e2e — Home→Open other library + edit→Home→reopen
- [ ] pnpm stryker:diff — ≥60; survivors noted honestly (`browserSessionState.ts` gaps, not “all equivalent”)
- [x] pnpm test:lhci — N/A (`recents-home-quality`)
- [x] UI in scope: minimal HomeScreen ARIA + loading; full ui-review in quality follow-up
- [x] Docs/rules sync: roadmap quality + book-titles; soften specs; re-archive
- [x] pnpm audit:ci — N/A
- [x] Launch openspec-proposal-reviewer then openspec-design-reviewer; resolve before apply
- [x] Launch `openspec-implementation-reviewer`; resolve before finish
- [ ] Manual check — operator folder-picker on preview (scenarios below); unticked until recorded
- [ ] High-risk security surface — Security Review if FSA paths change materially

## Manual test scenarios

_(Operator on preview with real folder picker; expected results inline.)_

1. Cold start → empty home.
2. New library (libA) → book → place 2 photos → F5 → same book with photos.
3. Home → home; F5 stays on home.
4. Home → click recent book → opens with photos.
5. With libA’s book open: New library (libB) → clean empty book; libB has no copy of libA’s book.json; filmstrip shows libB photos after Add folder.
6. With libB’s book open: Home → Open libA → editor shows libA’s book; libA/books/ contains no libB book.
7. Edit something and immediately click Home → reopen → the edit is there.
8. New library → cancel the picker → the current book is still open.
9. Reopen the same folder via Open → no duplicate in recents.
10. Open the same book in a second tab → “This book is open in another tab…”; recents order unchanged; back on home, Start editing has no lock banner.
11. “Don’t Allow” on the write permission prompt → a message is shown.
12. Narrow window (~900px) → usable.
