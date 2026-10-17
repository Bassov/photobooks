# add-spread-reveal-flake

Tag: prep
Milestone: M2.1
Title: Strict fit-zoom add-spread containment: app scroll or deterministic wait

## Scope

- [ ] Keep the strict `spreadViewContained` assertion in `e2e/spread-view.spec.ts` ("Add spread keeps the fitted zoom" / editor-shell "lies within the pasteboard scrollport"). Do not loosen overlap, tolerances, retries, skip, or delete the helper
- [ ] Fix with app code (scroll/reveal the new fitted spread fully inside `pasteboard-scroll`) and/or a deterministic wait for layout/scroll settle — never a weaker assertion
- [ ] Prove locally with Playwright `--repeat-each` until strict containment is reliable
- **Done when:** strict containment for `add spread keeps the fitted zoom and reveals the new spread` passes 50/50 locally and in CI
