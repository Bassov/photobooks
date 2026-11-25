# qa-settings-pill

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item qa-settings-pill

## Scope

- [ ] QA-2 (prod QA 2026-11-25, PR #725): the canvas layout-cycle pill ("‹ One per page 2/4 ›") stays painted over the editor Settings and takes clicks there. While Settings is open the editor shell is inert (as under Preview) and Settings paints above every canvas overlay; ⇧[ / ⇧] do not cycle the layout behind it; Back to the book returns focus to ⚙ and shows the pill again.
- [ ] New e2e `e2e/settings-over-canvas.spec.ts`: pill visible on spread 2–3 → open Settings → pill hidden, `elementFromPoint` / topmost paint at its old centre is Settings, ⇧] does not change the layout; Back → pill visible, same layout.
- [ ] Existing cycle-layouts / Settings / interface-size e2e pass unchanged.
- **Browser check:** 1440×900, open a book, select spread 2–3, open ⚙ Settings: no pill over the page, ⇧] does nothing; Back to the book: pill back.
