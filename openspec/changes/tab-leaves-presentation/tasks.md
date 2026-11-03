## Implementation

- [x] 1. `src/lib/focusTrap.ts` wrap helper with unit + PBT tests (`src/lib/focusTrap.test.ts`; stryker:diff 100 %)
- [x] 2. `SpreadPager`: focus the stage on open, trap Tab / Shift+Tab, restore focus to the opener on close; unit tests (`SpreadPager.test.tsx` "takes focus on open, keeps Tab inside and returns focus to the opener", "skips the focus return when the opener is gone")
- [x] 3. Kit `Presentation`: same focus in / trap / restore; kit qa Tab ×10 / Shift+Tab ×10 / Esc → opener check (`qa.mjs` "tab-leaves-presentation: …", qa:quick 334 passed / 0 failed)
- [x] 4. e2e `presentation-mode.spec.ts`: Tab ×10 / Shift+Tab ×10 stay inside, Esc → focus on Present ("Tab and Shift+Tab stay inside the presentation; Esc returns focus to Present")
- [x] 5. Spec delta: Spread pager keeps focus inside and returns it to the opener (`specs/spread-view/spec.md`)

## Manual test scenarios

1. Open a book, click Present, press Tab 10 times and Shift+Tab 10 times: focus stays inside the presentation; Esc closes it and Present is focused.
