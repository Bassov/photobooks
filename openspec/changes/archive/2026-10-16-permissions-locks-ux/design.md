# Design

## Context

See proposal.md. Lock acquire/release and typed `permission-required` / `locked-elsewhere` exist; `tryRestore` only shows status; editor never holds locks. Open library already uses `showDirectoryPicker`.

**Assumption:** roadmap Perf line — chrome status/banner only; existing save/autosave gesture gates stay green.

**Decision:** no `session-state` delta — editor wires lock lifecycle only.

## Decisions

1. **Re-grant = Open library path (two outcomes)** — On `permission-required` (restore or save), set `accessPhase: 'permission-required'` and show a focusable chrome **button** `data-testid="regrant-library"` (labeled e.g. “Grant access”, keyboard-reachable) that runs the existing open-library picker on activation. **Restore-time:** after the user picks the library folder with readwrite access, load the persisted book id (same as successful restore). **Mid-session (save/autosave):** re-bind storage from the picked handle, keep the current in-memory book and dirty/savePhase, clear `accessPhase`, then retry save — do **not** reload from disk (preserves dirty edits per existing save-failure rules).

2. **Lock on activate** — After a successful create/open/restore/adopt that yields `bookId`, call `session.acquireBookLock(bookId)`. Hold `BookLock` on the session module; release before switching books, unbind, or reset. If acquire returns `locked-elsewhere` for that book id: do **not** activate writable library-backed editing for **that** book; set `accessPhase: 'locked-elsewhere'` and `blockedBookId`; show banner text “This book is open in another tab” (`data-testid="book-lock-banner"`); skip attaching that book as writable.

3. **Exit locked-elsewhere** — Banner stays while `accessPhase === 'locked-elsewhere'`. Cleared when the user successfully activates a **different** book or creates a new book that acquires its lock. Retrying the same contended book keeps the phase. Contended book alone is non-writable; Open library / New book stay reachable.

4. **Block writes when locked** — While `accessPhase === 'locked-elsewhere'`, `saveBookNow` / autosave for `blockedBookId` early-return; do not attach that book as the active writable document. (Assumption: no read-only load of the contended book in this change.)

5. **Chrome** — Re-grant button + lock banner beside existing library chrome. No new scrollport.

6. **Test seams** — Extend `__photobooksProject` / memory session: force `permission-required` on recall; hold a lock from a second memory session. No real multi-tab FSA in Playwright.

## Touch-set

`src/editor/projectSession.ts` (+tests), `src/editor/EditorShell.tsx` (+CSS), `e2e/permissions-locks.spec.ts` (or extend open-save), reuse `assertDocumentFitsViewport`. Prefer not editing `src/project` contracts unless a tiny test helper is required.

## Composition

`projectSession` owns `accessPhase`, lock hold/release, and re-grant entry that reuses open-library. Shell is presentational. `src/project` adapters unchanged.

## Tests

Public APIs: `tryRestore`, open-library / re-grant, activate book + lock, `saveBookNow` when locked.

- Unit: permission-required sets accessPhase; restore-time re-grant loads book; mid-session re-grant rebinds + retries save without wiping dirty; acquire on activate; locked-elsewhere blocks save; release on unbind; Open/New different book clears lock phase.
- E2E empty: no re-grant, no lock banner; viewport contained.
- E2E happy / primary interact: permission-required → activate re-grant control → book restored; mid-session path covered in unit if picker hard in e2e.
- E2E lock / primary interact: hold lock elsewhere → open book → banner + Save unavailable / no persist.
- `ui-review` before push.

## Security

FSA directory picker only on user gesture (re-grant / Open). Handles stay on SessionState / adapter; never in `book.json`. Web Lock names stay inside `src/project/session`. No new CSP / dependency surface.

## Risks / Trade-offs

- [User picks a different folder] → Treat as normal open library; acceptable.
- [Tab crash] → Web Locks release on tab close; no force-steal.
- [Autosave races release] → Cancel autosave before release; invalidate in-flight save generation.

## Migration Plan

Additive. Rollback = revert PR.
