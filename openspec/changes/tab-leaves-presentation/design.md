## Decisions

1. The trap lives in `SpreadPager` (only prod overlay path; `PresentationMode` its only caller). On mount it records `document.activeElement` as the opener and focuses the stage (`tabIndex={-1}`); on unmount it focuses the opener back if still connected.
2. Tab / Shift+Tab go through the existing window keydown capture listener: `preventDefault`, then `trapTab` (`src/lib/focusTrap.ts`) focuses the next / previous tabbable outside `[inert]`, wrapping, or the stage when there is none.
3. Kit `Presentation` mirrors 1–2 inline (kit cannot import `src/`).
4. No `inert` on chrome: kit `main.tsx` strips it, and the trap covers Tab.
5. No visual change: the stage gets `outline-none`, no new tokens or primitives; skill `ui-review` before push.

## Touch-set & Test Plan

| Path                                    | Why                              |
| --------------------------------------- | -------------------------------- |
| `src/lib/focusTrap.ts`                  | wrap helper                      |
| `src/lib/focusTrap.test.ts`             | unit + PBT                       |
| `src/render/SpreadPager.tsx`            | focus in, trap, restore          |
| `src/render/SpreadPager.test.tsx`       | unit                             |
| `uikit/src/demo-parts/presentation.tsx` | kit mirror                       |
| `uikit/scripts/qa.mjs`                  | kit Tab / Shift+Tab / Esc check  |
| `e2e/presentation-mode.spec.ts`         | prod Tab / Shift+Tab / Esc check |
| `openspec/specs/spread-view/spec.md`    | archive sync                     |

- Reuse: existing keydown listeners; `openSessionEditor`.
- Tests: unit (focus in on mount, Tab / Shift+Tab stay inside, restore, detached opener skipped); PBT (wrap in `[0, count)`); e2e + kit qa as Done when.
