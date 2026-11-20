## Decisions

1. `View.thumb: number | "auto"`, default `"auto"`; `StudioProvider` seeds it from the v2 key unless the `view` prop sets it. Pure helpers in `store.tsx` give auto / max / effective H for an `innerHeight`; a resize listener re-renders, and re-clamping is render-only (never writes).
2. Separator lives in `Dock` (absolute, `-top-[5px] h-[9px]`), shown only when the dock shows the photos strip. `EditorFrame` panel-b clips only while collapsed; open, the 5 px above the edge paints over the canvas by DOM order (no z-index: one would lift the dock over the menu underlay and keep chips hovered).
3. Drag: pointer capture; H = snap4(startH + startY − y), clamped; state on every move, localStorage written once on pointerup. Chip uses the prod crop-tag look (`bg-field`, `rounded-md`).
4. No resting dock border (v0.7.1 "no borders"); hover / drag / focus draw the 1 px edge line and pill per roadmap, colours from kit tokens (`--input`, `--select`, uikit/src/index.css).
5. Separator keys call `stopPropagation` so canvas nudge keys do not fire.

## Touch-set & Test Plan

| Path                                      | Why                                                             |
| ----------------------------------------- | --------------------------------------------------------------- |
| `uikit/src/sandbox/store.tsx`             | thumb type, helpers, persistence                                |
| `uikit/src/sandbox/chrome.tsx`            | separator in `Dock`, H in `Filmstrip` + empty row, panel-b clip |
| `e2e/kit-filmstrip-resize.spec.ts`        | new kit checks                                                  |
| `docs/roadmap/P5/filmstrip-resize-kit.md` | item                                                            |

- Reuse: `thumbWidth` (ui.tsx), the `__demo` API as in `kit-filmstrip.spec.ts`.
- e2e: per roadmap Done when, incl. `elementsFromPoint` paint. Skill `ui-review` before push.
