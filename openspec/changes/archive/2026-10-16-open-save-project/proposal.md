# Proposal

## Problem

The editor keeps the book only in memory. Closing the tab loses gallery and layout. LibraryStorage, SessionState, and AssetSource exist but are not wired into the shell.

## Why now

Next roadmap item after `derived-cache-opfs`; M2 needs explicit save so a book survives reload.

## Scope in

- Create / open a library folder (FSA); create one book; persist gallery and layout in `book.json`
- Library-backed import registers source roots and asset identity for reopen
- Save (Ctrl/Cmd+S); restore after reload when the remembered handle is still granted (else open the same folder again via picker)
- Serialization off the gesture path (background priority; worker if over budget); save-during-drag within frame-budget gates
- Thin open/create/save chrome and status for typed failures (`permission-required`, `locked-elsewhere`); no new home/recents screen
- Spec deltas: `editor-shell`, `frame-budget`

## Scope out

- Autosave (`autosave`); permission re-grant and multi-tab lock UX (`permissions-locks-ux`); home/recents (`recents-home`); missing-assets relink (`missing-assets-relink`)
- Multi-book picker; changing LibraryStorage / SessionState / AssetSource domain contracts beyond thin editor wiring

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `editor-shell`: library create/open, create book, save/restore, source-root registration on import, non-blocking status for typed open/save failures
- `frame-budget`: save-during-drag scenario — zero LoAF

## Success criteria

- Empty: no library open — chrome offers create/open library; filmstrip + pasteboard remain the only scrollports (no page-level H/V scroll)
- Happy path / Browser check: create or open library, create book, import, edit, Ctrl/Cmd+S; reload and restore (granted handle or re-pick folder) — same gallery and placements
- Primary interact: save during an active drag — zero LoAF
- One active library + one active book in this change

## Risks

- **Security:** FSA readwrite library root via directory picker; handles never in `book.json`
- Size: one UI-region subsystem; reuse existing adapters; test seams so e2e can run without real pickers
