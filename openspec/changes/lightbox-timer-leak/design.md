## Decisions

1. `useLightboxZoom` clears `timer.current` in the cleanup of its existing mount-once wheel `useEffect` (`[rootRef]`, a stable ref) — no new deps array, which would only add an equivalent mutant. The settle callback keeps its shape; while mounted, the timer is still reset per input as before.
2. Sites checked in `src/render/` (non-test): `LightboxPager.tsx` keydown listener, `SpreadPager.tsx` keydown listener, `hoverPointer.ts` matchMedia listener, `useLightboxZoom.ts` wheel listener, ResizeObservers in `CoverView.tsx`, `LightboxPager.tsx`, `SpreadPager.tsx` — each already removed / disconnected in its effect cleanup. No `requestAnimationFrame` / `setInterval` in `src/render/`. Left as is.

## Touch-set & Test Plan

| Path                                | Reason                        |
| ----------------------------------- | ----------------------------- |
| `src/render/useLightboxZoom.ts`     | unmount cleanup for the timer |
| `src/render/LightboxPager.test.tsx` | unmount-mid-settle unit test  |

- Reuse: existing `Harness` / `wheel` helpers in `LightboxPager.test.tsx`.
- Tests: unit — Ctrl + wheel zoom under fake timers leaves 1 pending timer; after `unmount()` `vi.getTimerCount()` is 0 (fails on main with 1). No PBT / e2e (no user-visible change).
