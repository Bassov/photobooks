# design-r44-relink-border-prod

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r44-relink-border-prod
Status: done

## Scope

Design Round 44, Must M154: the last two Relink dialog differences after M150 (#704). Prod only; the kit
RelinkDialog (`uikit/src/demo-parts/dialogs.tsx`) is the reference.

- [x] Panel border: the Relink panel drops the base `.pb-dialog` 1 px border (`border: 0` in the Dialog `style`
      in `src/editor/relink/RelinkDialog.tsx`; `src/ui/Dialog.css` unchanged, other dialogs keep theirs).
- [x] Subtitle line-height 1.45 (18.85 px at 13 px) in `src/editor/relink/relinkStyles.ts`.
- [x] `e2e/design-r40-relink.spec.ts` M150 test reads offsets from the panel's outer box and asserts the numbers below.
- **Done when** (1440×900, Relink dialog open): panel computed border-width 0; title box at 24,20 from the panel's
  outer top-left; Skip/Rescan/Resolve 20 px from the panel bottom and Resolve 24 px from the right (±0.5); subtitle
  line-height 18.85 (2-line box 37.69), list top 103.94 from the panel top (±0.5); everything else from M150 unchanged.
- **Browser check:** `e2e/design-r40-relink.spec.ts` (Chromium, 1440×900).
