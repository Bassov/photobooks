# kit-undo-dup-select

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item kit-undo-dup-select
Status: done

## Scope

- [ ] Kit spread-list rows paint the selection tone (#CACACA) in the same frame `aria-selected` flips: no background-colour transition on `.e7-item` (`uikit/src/sandbox/v7.tsx`) or on the shared `ThumbItem` (`uikit/src/components/app/ui.tsx`), so undo / redo of Duplicate spread never shows a half-tweened row.
- [ ] `e2e/kit-undo-fixes.spec.ts` "undo of Duplicate spread selects the original, redo the copy" passes `--repeat-each=20 --workers=4` 20/20 locally without weakened assertions; it also checks the row paint after redo.
- **Browser check:** `/uikit/#/demo`, New book, spread 4 menu → Duplicate, Ctrl+Z, Shift+Ctrl+Z: the highlighted row follows the selection instantly.
