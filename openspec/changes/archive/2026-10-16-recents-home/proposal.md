# Proposal

## Problem

After a library is opened once, cold start still drops the user into an empty editor with only New library / Open — there is no home that lists recent libraries and their books for one-click return.

## Why now

Next after `permissions-locks-ux`; SessionState remembers handles but not a multi-library recents list or home UI.

## Scope in

- Home as cold-start when no book is active: recent libraries (SessionState / IndexedDB) and books in the chosen library
- Multi-library recents (stable ids + display labels); update on create/open; promote active library/book ids into SessionState as needed
- One click opens a book via remembered handle (existing re-grant on permission-required); New library / Open remain escape hatches
- Spec deltas: `session-state` (recents), `editor-shell` (home + open-from-recents)
- Roadmap Browser check + Perf line (assumption written into `docs/roadmap.md`): home is static list chrome; existing save/gesture gates stay green; if the home list overflows, scroll only inside a named home scrollport (no page-level H/V scroll)

## Scope out

- Missing-assets relink; LibraryMeta/book-title schema richness beyond ids + folder label
- Library-storage on-disk layout; cross-device sync; M3 features

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `session-state`: ordered recent libraries beyond a single hardcoded id
- `editor-shell`: home screen; open book from recents in one click

## Success criteria

- Empty: no remembered libraries — home shows clear empty copy plus New library / Open; no page-level H/V scroll
- Happy path / Browser check: after opening a library and book once, reopen the app — home lists that recent library and its books; one click opens the book into the editor
- Primary interact: choosing a recent library reveals its books; clicking a book enters the editor; overflow scrolls only inside the named home scrollport; after open, filmstrip + pasteboard remain the editor scrollports
- Perf: home is static list chrome; existing save/gesture gates stay green
- Existing restore / re-grant / lock paths stay intact

## Risks

- **Security:** File System Access handles stay opaque on SessionState; never into `book.json`; open-from-recents uses permission recall / re-grant; picker only on user gesture
- Migrating from single `library` id must not orphan existing remembered handles
- Listing books needs a granted handle — permission-required must not look like a silent empty library
