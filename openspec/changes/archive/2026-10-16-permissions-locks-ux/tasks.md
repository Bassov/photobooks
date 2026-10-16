# Tasks

## 1. Access phase + re-grant

- [x] 1.1 Extend `projectSession` with `accessPhase` (`idle` | `permission-required` | `locked-elsewhere`), set `permission-required` on restore/save failures, expose snapshot fields + `regrantLibrary` that runs open-library picker; restore-time loads persisted book, mid-session rebinds handle and retries save without wiping dirty — verify unit tests for both paths
- [x] 1.2 Add focusable chrome button `data-testid="regrant-library"` (label e.g. Grant access) when `accessPhase === 'permission-required'` — verify it is absent when idle/granted and present after simulated permission-required

## 2. Single-writer lock

- [x] 2.1 Acquire book lock on successful create/open/restore/adopt; release on book switch/unbind; on `locked-elsewhere` set phase + `blockedBookId`, skip writable activation, block save/autosave for that book; clear phase on successful different/new book — verify unit tests for acquire/release, lock fail, save blocked, phase clear
- [x] 2.2 Show lock banner `data-testid="book-lock-banner"` with “This book is open in another tab” when locked-elsewhere — verify visible only in that phase

## 3. E2E

- [x] 3.1 Playwright empty + happy + primary interact: no re-grant/banner when clean; force permission-required → activate re-grant → book restored; hold lock elsewhere → open book → banner + Save does not persist; `assertDocumentFitsViewport` — verify `pnpm test:e2e` for the new cases (3/3 green)
- [x] 3.2 Add roadmap Perf line (assumption) on `permissions-locks-ux` in `docs/roadmap.md` — verify the item documents chrome-only updates and existing save/autosave gesture gates

## 4. Verification checklist

- [x] pnpm typecheck — green (`pnpm verify:fast`)
- [x] pnpm lint — green
- [x] pnpm test — green (634)
- [x] pnpm test:e2e (or pnpm verify) — `e2e/permissions-locks.spec.ts` 3/3 green
- [x] pnpm stryker:diff — no mutable files in scope (EditorShell / projectSession excluded; reasons updated in `stryker.mutate.md`)
- [x] pnpm test:lhci when UI or bundle size is affected — green
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — empty: no re-grant/banner; happy: Grant access → regrant restores bookId; lock: banner + Save/Add photos/Add folder disabled, New book enabled; MCP + Playwright viewport containment; a11y: labeled Grant access, polite lock banner
- [x] Docs/rules sync: Perf line on roadmap item; `stryker.mutate.md` exclude notes; no AGENTS.md map change
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — clean (FSA picker / Web Locks; no new deps)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: fccca9ed)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: b3a7921c pass after fixes; prior 09d65608)
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] High-risk security surface: Cursor Security Review subagent before archive (evidenced: 9eed5411 — Medium save-after-release race fixed via saveEpoch; no remaining medium+)

## Workflow follow-up

- Archive the change after implementation review + Manual check pass; sync delta specs; tick roadmap item.
- Commit, push, open PR, wait for CI green.

## Manual test scenarios

1. Open `http://127.0.0.1:5173/` — no Grant access button, no lock banner; New library / Open visible; empty gallery copy readable; no page H/V scroll (MCP snapshot).
2. Via `__photobooksProject.setAccessPhaseForTests('permission-required')` — Grant access appears and is focusable; after `regrantLibraryWithHandleForTests` / e2e path, button clears and bookId restores (Playwright + unit).
3. Attach memory library, create book, `holdExternalBookLockForTests` + `tryActivateLibraryBookForTests` — banner “This book is open in another tab”; Save / Add photos / Add folder disabled; New book enabled; document cleared to placeholder (e2e + unit + MCP).
