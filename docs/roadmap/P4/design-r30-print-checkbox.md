# design-r30-print-checkbox

Tag: lite
Milestone: P4
Title: Bug: /next-roadmap-item design-r30-print-checkbox

## Scope

Designer parity pdf-export (2026-11-15, Must M121, Spec PE9): the shared
`src/ui/Checkbox` (`.pb-check` in `src/ui/Field.css`) follows the kit Checkbox
(`uikit/src/components/ui/checkbox.tsx`). Callers fixed: the Print dialog bleed
checkbox (`print-bleed`) and the `src/ui` specimen page.

- [ ] Checked and indeterminate box fill `--color-mark` (rgb(142,142,142)); invalid + checked fills `--destructive-solid`.
- [ ] Tick and indeterminate minus are 16×16 icons filling the 16×16 box (no inset).
- [ ] Label 13 px / 500 / line-height 13 px; disabled opacity like the kit (label 0.7, box 0.5).
- [ ] Unchecked colour, radius 6 and focus ring unchanged.
- [ ] `e2e/design-r30-print-checkbox.spec.ts` checks the checked box by paint (clipped screenshot), the tick box, the label type and the unchanged states; `src/ui/forms.test.tsx` and `e2e/print-dialog.spec.ts` green.
- **Browser check:** open Print on the painter fixture; the bleed checkbox reads as the kit's grey mark with a full-size tick and a medium-weight label.
