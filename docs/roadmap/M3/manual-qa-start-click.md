# manual-qa-start-click

Tag: prep
Milestone: M3
Title: manual-qa start-session click

## Scope

## Scope

- [ ] `pnpm agent manual-qa` scenarios time out: the welcome `<header>` intercepts the start-session click (`WelcomeScreen.tsx`). Fix the overlap or the harness click so manual QA runs again.
- **Found in:** `spread-list-panel` (run 3). Manual QA was evidenced by `e2e/spread-list-panel.spec.ts` instead.
- **Browser check:** `pnpm agent manual-qa` opens a session and runs a trivial scenario to OK.
