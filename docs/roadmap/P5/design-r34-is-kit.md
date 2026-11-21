# design-r34-is-kit

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r34-is-kit
Status: done

Round 34 Must M134 (Designer parity interface-size, Spec §1), kit Segmented lane. Prod `src/ui/SegmentedControl` and Spec §1 are the reference; no prod edits.

## Scope

- [ ] M134: kit `Segmented` (`uikit/src/components/app/controls.tsx`) uses radio-group keyboard semantics like prod `SegmentedControl`: an arrow key moves focus and selects the next/previous option at once (wrapping like prod; Home/End only if prod has them). On kit Settings → Interface size, ArrowRight from 100 % selects 125 %, the hint updates and the choice is stored.
- [ ] Every kit caller of `Segmented` still behaves; they are listed in the PR body.
- [ ] An e2e check in `e2e/kit-*.spec.ts` pins the keys (not qa.mjs).
- **Browser check:** kit #/demo settings step: focus 100 %, ArrowRight → 125 % checked and hint updated; ArrowLeft → 100 % checked.

## Done when

1. In the kit at #/demo settings step: focus 100 %, ArrowRight → 125 % selected (aria-checked), hint updates; ArrowLeft back → 100 %.
2. Same keyboard behaviour as prod SegmentedControl (Home/End if prod has them).
3. Pinned in `e2e/kit-*.spec.ts`; never in qa.mjs.
