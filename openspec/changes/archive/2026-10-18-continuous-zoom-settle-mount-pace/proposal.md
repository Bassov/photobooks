# Proposal

## Problem

On continuous zoom-out settle, shrinking pasteboard stride expands the virtual window so many `ConnectedSpreadView`s mount in one frame and record LoAF under CPU throttle. The main-parity zoom-out burst+200 ms settle case still sits under parent `retries: 2` and does not assert through gesture-end remount.

## Why now

M2.1 needs that case under `retries: 0` with unchanged budgets. The prior frame-budget flake item deferred full settle remount to this prep.

## Scope in

- Pace pasteboard virtual-window expansion when the target window grows on zoom-out settle.
- Extend the main-parity continuous zoom-out LoAF window through gesture-end / newly visible mounts; move that case to `retries: 0`.
- Keep `PERF_BUDGETS` and zero-LoAF asserts unchanged.

## Scope out

- Looser budgets, retries, skips, or measurement windows that hide jank.
- Filmstrip / other frame-budget suites.
- Changing whole-book fit mount semantics (full stack still must end mounted when it fits).

## Success criteria

- Main-parity continuous zoom-out burst + settle asserts zero LoAF through gesture-end remount; case under `retries: 0`.
- During paced expand the visible pasteboard scrollport stays covered (no empty holes); by gesture-end, whole-book fit mounts every spread when the stack fits.
- CI burn-in / `--repeat-each=20 --retries=0` is the flake proof (one local green run of targeted specs is enough).
- Budgets in `src/perf/budgets.ts` unchanged; no new retries.

## Risks

- Under-pacing leaves holes in the visible scrollport mid-settle (window must still cover the port; spacers keep scroll extent).
- Over-aggressive caps delay whole-book fit mount beyond settle (must finish by gesture-end).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `spread-view`: paced virtual-window expansion when the target mounted range grows (esp. zoom-out settle); scrollport coverage and final whole-book mount unchanged.
- `frame-budget`: continuous zoom-out LoAF window includes gesture-end remount of newly visible spreads.

## Impact

Pasteboard virtualization / mount pacing; continuous-zoom e2e under `spread-view` frame-budget describes.
