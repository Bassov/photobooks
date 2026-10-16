# Proposal

## Problem

Save is explicit only (Ctrl/Cmd+S). Closing or reloading the tab without saving drops unsaved edits even when a library-backed book is open.

## Why now

Next roadmap item after `fix-open-save-adopt-hydrate`; M2 needs durable edits without requiring a manual save each time.

## Scope in

- Debounced autosave when a library-backed book is dirty and idle (no active pointer/drag/zoom gesture)
- Save indicator in chrome: Saved (clean), pending, saving, error (reuse typed storage failure codes)
- Autosave reuses the existing save path (hash await, background priority serialization; worker if over budget)
- Spec deltas: `editor-shell`, `frame-budget`
- Perf gate: continuous drag while autosave would fire — zero LoAF

## Scope out

- Permission re-grant / multi-tab lock UX (`permissions-locks-ux`); home/recents; missing-assets relink
- Changing LibraryStorage / SessionState domain contracts
- Offline conflict merge; multi-book autosave queues

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `editor-shell`: debounced autosave after edits; save indicator; no autosave during active gestures
- `frame-budget`: continuous-drag-while-autosave scenario — zero LoAF

## Success criteria

- Empty: library open, clean book — indicator shows idle/saved; Save still available; filmstrip + pasteboard remain the only scrollports (no page-level H/V scroll)
- Happy path / Browser check: edit a library-backed book — after idle, indicator reaches saved (via pending/saving); reload without Ctrl/Cmd+S — changes are kept; editing never hitches on autosave
- Primary interact: continuous drag while the autosave debounce would fire — zero LoAF; autosave never starts during an active gesture
- Manual Save and Ctrl/Cmd+S still work and clear dirty / show saved

## Risks

- **Security:** no new FSA surface; autosave writes only through the already-open library storage adapter; handles stay out of `book.json`
- Size: wiring + indicator on existing project session — no new subsystem; debounce must not race with in-flight save
