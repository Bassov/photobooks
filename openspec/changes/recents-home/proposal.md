# Proposal

## Problem

PR #71 review: no Home from editor; re-grant opens the wrong book / any folder; duplicate recents after restart; silent IDB failures; restore/home races; New library adopts the open book into a new folder; opaque error codes.

## Why now

These block a safe returning-user loop before merge.

## Scope in

- Editor **Home**: release lock, clear in-tab book id, show home; reload stays on home
- Re-grant: remember clicked book; `requestPermission` first; picker only on failure + `isSameEntry` before bind; Don't Allow → message
- Dedup via `isSameEntry` without permission; bump recents only on success; single IDB txn; cap (~10); remove dead recent
- Home IDB/error + retry (no unhandled rejection); loading until restore settles; busy-serialize actions
- New library with open book: release first, clean empty book (no `book.json` copy), new-folder filmstrip
- Human-readable errors; permission books panel hint + Grant; clear stale ids on failed restore; read `__active` to preselect last library; test hooks DEV/e2e only
- Unit/e2e for Home, re-grant, dedup, restore-fail, IDB error (minimal)

## Scope out

- Book titles / rename (later roadmap)
- Follow-up `recents-home-quality`: a11y polish, full HomeScreen RTL suite, LHCI editor surface, open-save empty asserts, reserved-key mutation tests, Codecov HomeScreen push (PR already >~1000-line guideline)

## Success criteria

- Empty: IDB ok → empty copy; IDB fail → error + retry; loading until restore settles; no page-level H/V scroll (overflow only in `home-scroll`)
- Happy: Home → home; F5 with active book → editor; new tab → recent → **that** book with photos; `__active` preselects last library
- Re-grant / Don't Allow / picker mismatch behave as Scope in; failed open does not reorder; same folder → one recent
- New library with open book → clean editor + new filmstrip
- Busy disables double-activation without stealing focus
- **Perf:** home stays static-list chrome; existing save/gesture gates stay green

## Risks

- **Security:** directory handles stay opaque; re-grant never binds a picker folder without `isSameEntry`; permission denial is an explicit failure, not silent success
- Cap drops older recents; `isSameEntry` without permission is Chromium FSA
- Correctness delta still grows #71; quality deferred to `recents-home-quality`
