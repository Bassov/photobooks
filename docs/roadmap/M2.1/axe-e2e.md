# axe-e2e

Tag: prep
Milestone: M2.1
Title: automated ARIA checks in e2e (issue #72 C, #50 item 1)

## Scope

- [ ] `@axe-core/playwright` (exact-pinned through `dependency-policy`) and a shared `e2e/fixtures/axe.ts` that fails on `serious` / `critical`. The allowlist lives in `quality/gates.json`, may only shrink, and each entry has a reason
- [ ] Run it on home (empty and with recents), the New / Open library flow, the editor (empty and filled), a selected gallery photo, an active move source, and after Unplace. The `@preview` project reuses the fixture
- [ ] A self-test of the fixture: a page with a `listbox` wrapping buttons and `aria-selected` on a `button` fails
- **Done when:** the PR #71 ARIA pattern fails CI, and every listed state runs axe in `integration`.
