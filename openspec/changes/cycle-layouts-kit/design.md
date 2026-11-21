## Decisions

1. Set and step (Spec D3/D4): `cycleSet` filters the picker list (builtins after merges, then My templates of this
   shape) by N own photo frames; `stepLayout` wraps; Custom → first / last.
2. Rebind (D6): one `rebindFrames` keeps every old frame prop and id, takes the template rect, `rot` 0. Used by the
   cycle and by the picker's `applyTemplate`.
3. Pill: inside the active `data-stack-item`, `bottom: calc(100% + 8px)`, centred on the paper (75 % on page 1). The
   kit stack re-lays out on zoom, so screen px need no `--cam-scale`. Room `i === 0 || gap ≥ 63`; other hide rules per
   Spec (gestures via a store `drafting` flag and `:has()` on marquee / text edit).
4. Keys: physical `BracketLeft/Right` + Shift only; act and `preventDefault` under the Spec conditions minus room.
5. History: `cycle:<spreadId>` coalesces with no window (D5).
6. Fit centring in the stack uses the 56/48 band (prod `placedScroll`).

Tokens: `--chrome`, `--field`, `--accent`, `--card-edge`, `--radius-md`, kit ink `T` / `SUB`; tooltip = top-bar
`.e7-tip` primitive. Skill `ui-review` before push.

## Touch-set & Test Plan

| File                                 | Why                    |
| ------------------------------------ | ---------------------- |
| `uikit/src/sandbox/templates.ts`     | set / step             |
| `uikit/src/sandbox/layout-cycle.tsx` | pill, op, keys         |
| `uikit/src/sandbox/viewport.tsx`     | pill slot, keys, band  |
| `uikit/src/sandbox/store.tsx`        | coalescing, `drafting` |
| `uikit/src/sandbox/chrome.tsx`       | `applyTemplate`        |
| `uikit/scripts/demo-capture.mjs`     | 3 steps                |
| `e2e/kit-layout-cycle.spec.ts`       | new spec               |

- e2e (`#/demo` 1440×900): geometry ±0.5 with a paint hit test, hidden cases, ⇧] vs `]`, run + Ctrl+Z, props kept.
