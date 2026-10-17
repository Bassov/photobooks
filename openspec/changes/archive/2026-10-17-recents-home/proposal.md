# Proposal

## Problem

Browser re-test of PR #71 found data bugs from the prior hardening round: Home leaves a stale book that Open/New library adopts into another folder; pending autosave is dropped on leave; New library releases before the picker; remember failure can leak a lock; editor stays interactive during restore; locked-elsewhere sticks on home; invalid ARIA on the recent list.

## Why now

These are merge blockers (data integrity / data loss) on an already-large PR.

## Scope in

- Home clears the editor document/assets; never copy the previous book into another library on Open/New/re-grant
- Flush pending saves before leaving a book; on save failure stay in the editor with a readable message
- New library: pick folder first; cancel leaves the current book open
- Remember-after-open failure rolls back (no leaked lock) with a home error
- Restore pending blocks editor library actions; locked-elsewhere from home clears before Start editing
- Soften unimplemented claims (busy focus, hard IDB no-throw, absolute single-txn); fix Stryker note
- Drop invalid listbox/aria-selected on recent buttons; keep current-item marking
- Regression unit + minimal HomeScreen + e2e for Home→Open other library and flush-on-Home

## Scope out

- Book titles / rename (new roadmap item after quality)
- `recents-home-quality`: a11y/focus, full HomeScreen RTL, LHCI, IDB-blocked e2e, migration test, editor status codes, re-grant polish, txn locks, test-API runtime switch

## Success criteria

- Empty home still shows create/open; no page-level H/V scroll (overflow only in `home-scroll`)
- Happy: Home → home; F5 with active book → editor; recent → one-click opens that book with photos; same folder → one recent
- Home → Open/New other library: no foreign book file; editor shows the target library’s book
- Edit then immediate Home → reopen shows the edit; cancel New library picker keeps the book
- Remember failure → visible home error, no leaked lock; restore pending → library actions inactive
- Locked-elsewhere then home → Start editing has no lock banner
- Recent list: selected marked for a11y without listbox/option misuse
- **Perf:** home static chrome; existing save/gesture gates stay green

## Risks

- **Security:** handles opaque; remember failure rolls back instead of silent success
- PR already over ~1500 production lines; this round is blockers-only
