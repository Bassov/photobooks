# switch-size-parity

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item switch-size-parity
Status: done

## Scope

- [x] Prod inspector toggle (`.insp-toggle`, `Toggle` in `src/editor/InspectorControls.tsx`) matches kit `Switch size="sm"` (`uikit/src/components/ui/switch.tsx`): track 36×20 incl. 2px transparent border, knob 16×16 at 2px inset, 16px travel (Designer note on #491: kit 36×20 vs prod 32×18). Every prod `role="switch"` / `insp-toggle` caller uses the same size.
- **Browser check:** in the editor inspector, a toggle off and a toggle on measure track 36×20, knob 16×16 at x+2 / x+18 (±0.5px) like the kit `#/demo` inspector switch; no other inspector row height changes.
- **UI kit:** `uikit/src/components/ui/switch.tsx` `size="sm"` (reference; `uikit/**` not edited)
- **Hard nos:** no layout shift in other inspector rows; no kit edits.
- **Test:** Playwright e2e measures track / knob boxes off and on plus a clipped-screenshot paint probe of the knob.
