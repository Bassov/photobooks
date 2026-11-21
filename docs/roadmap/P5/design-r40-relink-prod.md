# design-r40-relink-prod

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r40-relink-prod

## Scope

- [ ] Designer parity M150 (Round 40, walkthrough-ux-review p5): the prod Relink dialog matches the kit `RelinkDialog` (`uikit/src/demo-parts/dialogs.tsx`) at 1440 × 900 (±1 px, measured from the panel's padding box): width 560; title 21 px / line-height 26.25 / letter-spacing −0.105 px at 24, 20; list on the `--field` fill with no border, margin 8 24 0; rows 36 high, padding 8 12, no divider; filename line-height 18.85; Missing badge with the shared Badge `dot` (5 px dot, padding 0 6 0 4); footer without a top border, buttons 20 px from the bottom and 24 px from the right. Shared `Badge` and base `.pb-dialog-title` unchanged; disabled Resolve stays flat grey (app-wide rule).
- **Browser check:** e2e `design-r40-relink.spec.ts` opens the Relink dialog with missing rows and reads the panel, title, list, row, badge dot and footer button geometry and computed styles; existing relink specs stay green.
