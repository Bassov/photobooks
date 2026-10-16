# Proposal

## Problem

After restart, restore often needs permission again but only shows a typed status string; SessionState locks exist but the editor never holds them, so a second tab can edit the same book.

## Why now

Next roadmap item after `autosave`; M2 needs one-step access recovery and a clear single-writer guarantee before recents/home and missing-assets.

## Scope in

- One-step permission re-grant: when restore/save hits `permission-required`, chrome CTA reopens the same library folder via the directory picker and resumes editing
- Acquire the existing book lock for the active library-backed book; on `locked-elsewhere`, block mutations with a clear “open in another tab” message
- Release the lock when leaving the book / detaching the library
- Spec delta: `editor-shell` (replace “full re-grant UX out of scope”)
- Roadmap Browser check; add light Perf line (assumption): chrome status/banner only; existing save/autosave gesture gates stay green

## Scope out

- Home / recents (`recents-home`); missing-assets relink
- LibraryStorage contract or FSA on-disk layout changes
- Cross-origin sync; waiting locks; force-steal
- New scrollports or panels beyond existing chrome status/banner

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `editor-shell`: re-grant CTA; single-writer lock; locked-elsewhere blocks editing

## Success criteria

- Empty: no library / clean open — no re-grant CTA and no lock banner; filmstrip + pasteboard remain the only scrollports (no page-level H/V scroll)
- Happy path / Browser check: after a restart that yields `permission-required`, one chrome action re-grants and restores editing; a second tab opening the same book sees “open in another tab” (or equivalent) and cannot mutate
- Primary interact: re-grant control runs picker/resume; locked tab keeps chrome readable without Save/edit mutations; document stays viewport-contained
- Existing save/autosave gesture gates remain green

## Risks

- **Security:** File System Access (picker / permission) and Web Locks; handles stay opaque on SessionState; never into `book.json`; picker only on user gesture
- Lock lifecycle vs autosave / tab close must not allow silent dual writers
- E2E via existing permission/lock test seams (no real multi-tab FSA picker)
