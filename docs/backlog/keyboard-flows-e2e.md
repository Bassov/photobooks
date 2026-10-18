# keyboard-flows-e2e

Tag: prep
Milestone: M2.1
Title: keyboard and live-region flows (#50 item 1)

## Scope

- [ ] `e2e/keyboard-flows.spec.ts`: focus after each action (place, swap, move, unplace, template switch), Escape cancels the move mode, Delete / Backspace, and the `aria-live` text
- [ ] Fix each bug found with a failing-first test. Fixes that do not fit become checkboxes right after this item
- **Done when:** each keyboard flow asserts `document.activeElement` and the live-region text.
