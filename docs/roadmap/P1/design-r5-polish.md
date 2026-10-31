# design-r5-polish

Tag: feature
Milestone: P1
Title: Bug: design-r5-polish: drag source keeps its photo, top-bar Library inset
Status: done

## Scope

- [ ] M43 (step 17): while a selected filled frame is dragged, the source keeps its whole photo at its crop, dimmed to the kit 0.4, with handles; as its own drop target it shows the kit tint and the centred "Release to replace" chip (never a frame-wide block over the photo). Restored after release.
- [ ] M44 (all editor steps): the top-bar "‹ Library" link matches the kit DOM at 1440: button left 12, padding-left 6 px, chevron 18 (16 × 16), gap 4 px, label 38.
- **Done when:** `e2e/design-r5-polish.spec.ts` green with `--repeat-each=30`; `design-r4-polish` and the other existing specs green and unchanged; full chromium e2e suite and the perf spec green.
- **Browser check:** 1440×900: drop a photo, click it, press and drag 60 px left: the dimmed photo stays whole under the chip; Escape and release restore it. The top-bar chevron sits at x 18, the label at 38.
- **UI kit:** `uikit/src/sandbox/canvas.tsx` (`FrameEl` drop overlay :124-128, `useDrag` :102-107), `uikit/src/sandbox/chrome.tsx` (`TopBar` Library :164). UI ref: `uikit#/demo` steps 16–18 and every editor step.
- **Source:** Designer round 5, 2026-10-31 (NOT PASS on prod e43a591).
