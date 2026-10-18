# lhci-key-surfaces

Tag: prep
Milestone: M2.1
Title: Lighthouse on the real surfaces with an a11y assertion (issue #72 C, #50 item 1)

## Scope

- [ ] `lighthouserc.mjs` `collect.url`: `/`, home with seeded recents (a dev/test-only query fixture, same pattern as `?fixture=painter`) and the editor with `?fixture=painter`
- [ ] Assert `categories:accessibility` at `error` with `minScore: 0.95` (value in `quality/gates.json`) on every URL. `scripts/lighthouse-pr-summary.mjs` reports per URL
- includes: LHCI measures the editor surface again (from main's `recents-home-quality`)
- **Done when:** LHCI audits all three URLs, and a score below 0.95 on any of them fails `lighthouse`.
