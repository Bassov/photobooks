## Decisions

1. State is a press number (`shown`, 0 = "Share"), not a boolean. Each copy sets a new number, so a second press during "Copied" re-runs the effect and restarts the window; a late clipboard promise from an earlier press just sets another number (the window restarts from its paint, never cuts short).
2. The window runs in a `useEffect` on `shown`: `requestAnimationFrame` (the frame that paints "Copied"), then `setTimeout(COPIED_MS)` back to 0. The effect cleanup cancels both, so unmount or a re-press leaves no stray timer (the old code could arm a timer after unmount when the clipboard settled late).
3. No CSS change: the labels already share one grid cell and `data-copied` alone picks the visible one, so exactly one is visible at any time; no new tokens or primitives.

## Touch-set & Test Plan

| Path                            | Why                                 |
| ------------------------------- | ----------------------------------- |
| `src/site/ShareButton.tsx`      | paint-anchored window, press number |
| `src/site/ShareButton.test.tsx` | race tests                          |

- Reuse: existing `stubDevice` / `press` helpers; fake timers also fake `requestAnimationFrame`.
- Unit: late clipboard promise (Share until it settles, then Copied 2000 ms from the frame); second click during Copied restarts the window; unmount with a pending promise arms no timer; the frame delay counts outside the window.
- e2e: `e2e/site-viewer.spec.ts:152` unchanged, `--repeat-each=30` plus a CPU-throttled run.
