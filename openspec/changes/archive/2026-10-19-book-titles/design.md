# Design

## Context

Schema v3 already has optional book `title`; `BookSummary.title` is listed from storage. Home still renders `book.id`; `createBookInLibrary` builds an untitled empty book; editor chrome has no title/rename. New book already uses `window.confirm` for replace — keep that prompt style for title ask (no new dialog subsystem).

## Goals / Non-Goals

**Goals:**

- Create asks for a title and persists it
- Rename from home and editor; chrome + home list show display title
- Empty/missing title → `"Untitled book"` in UI only
- Persist via existing save/autosave; LoAF-safe rename during filmstrip scroll

**Non-Goals:**

- Schema/migration; EXIF extract; rich modal framework; gate/CI scripts; new deps

## Decisions

1. **Display helper** — Pure `displayBookTitle(title: string | undefined): string` returns trimmed non-empty `title` else `"Untitled book"`. Never write the fallback into storage. Extend `bookTitle.ts` (or sibling) next to existing `bookTitleFromUnknown`.

2. **Create-with-title** — Before `createBookInLibrary`, chrome prompts (`window.prompt`). Cancel → no create. Empty/whitespace → store `""` (displays as Untitled). Pass title into `createEmptyLibraryBook` / `createBookInLibrary(title?)`.

3. **Rename active book (editor)** — Chrome shows display title + Rename. Prompt → `setTitle` BookOp → mark dirty → existing autosave/save. Local string update only (no list refresh thrash).

4. **Rename from home** — Per-book Rename next to open. If that book is the open editor book in this tab, reuse editor rename path. Otherwise: `loadBook` → set `title` → `saveBook` → refresh home list summaries. Do not swap the active editor document for a different book's rename.

5. **Home list types** — Widen `selectRecentLibrary` / home state from `{ id }` to `BookSummary` (`id` + `title`); render `displayBookTitle(summary.title)`.

6. **BookOp `setTitle`** — Add `{ type: 'setTitle'; title: string }` to `applyBookOp` so editor mutations stay on the op path and dirty tracking stays unified. No alternate store-patch path for editor rename.

7. **No new scrollports** — Home keeps `home-scroll`; editor filmstrip/pasteboard unchanged. Title chrome is inline text/button, not a card grid.

## Touch-set / e2e lock-ins

- Code: `src/project/bookTitle.ts` (+ test), `src/core/ops/applyBookOp.ts` (+ ops tests), `src/editor/projectSession.ts`, `libraryActivation.ts` (BookSummary return), `HomeScreen.tsx`, `EditorShell.tsx` (+ CSS/tests)
- Specs: `editor-shell` delta only
- Playwright lock-ins: **empty** home (Untitled / empty list still contained in `home-scroll`); **happy** create-with-title → rename → reload/reopen persists + home shows titles; **primary interact** rename while filmstrip scrolls (zero LoAF); home-scroll unchanged (no page-level H/V scroll)

## Security

No new FSA surface: titles persist only through existing `createBook` / `saveBook` / `loadBook`. Lock and permission failures surface status only; rename must not force unlock or escalate permission. Vitest/e2e directory fakes stay test-only.

## Risks / Trade-offs

- `window.prompt` is crude but matches current confirm UX and avoids a dialog subsystem (over budget).
- Home rename of a locked-elsewhere book may fail save — surface status/error; do not force unlock.
- Cancelled create must not allocate ids or touch storage.
