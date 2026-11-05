## Decisions

1. `meta.ts` owns the value rules (`tokenValue`, `fillTokens`) and `defaultAnchor`, per roadmap Scope; sections, canvas and store share them.
2. `store.tsx` `removeFrames(d, i, ids)` drops frames and freezes live text frames whose anchor is removed, in the same `st.update`. Callers: inspector Delete button and the Del key (`viewport.tsx`).
3. TextSection uses `Switch` with the `SwitchRow` classes (`SwitchRow` drops a caller `className`, the disabled row needs opacity .5 with an undimmed track; `isDisabled` when no image frame) and `SelectRow` (only while Live); the caret is remembered via a ref written on textarea blur.
4. Canvas `endEdit` keeps `x.live`.
5. Kit primitives only (`Switch`, `Select`, `bg-background`, `shadow-xs`, `text-2xs`, `text-muted-foreground`, `hover:bg-accent`); no new `docs/design.md` tokens.

## Touch-set & Test Plan

| Path                              | Why                         |
| --------------------------------- | --------------------------- |
| `uikit/src/sandbox/sections.tsx`  | Live block                  |
| `uikit/src/sandbox/meta.ts`       | value rules, default anchor |
| `uikit/src/sandbox/store.tsx`     | `removeFrames` helper       |
| `uikit/src/sandbox/inspector.tsx` | Delete button → helper      |
| `uikit/src/sandbox/viewport.tsx`  | Del key → helper            |
| `uikit/src/sandbox/canvas.tsx`    | no auto switch-off          |
| `uikit/scripts/demo-capture.mjs`  | step `editor-text-live`     |
| `e2e/kit-live-captions.spec.ts`   | regression                  |

- Reuse: `SwitchRow`, `SelectRow`, `metaOf`, `mapSpread`, setup from `e2e/kit-frame-keys.spec.ts`.
- e2e: per roadmap Test line (happy / interact / empty, inspector-relative y ±1 px).
