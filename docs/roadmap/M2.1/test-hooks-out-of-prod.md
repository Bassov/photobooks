# test-hooks-out-of-prod

Tag: prep
Milestone: M2.1
Title: test fixtures and hooks only in e2e builds (issue #47)

## Scope

- [ ] A `VITE_TEST_FIXTURES=1` build flag (set by the Playwright `webServer` and `pnpm perf` builds) guards `?fixture=painter` and `?testLibrary` with a dynamic `import()` so the deploy bundle drops them; `painterSourceFile` and its PNG encoder move out of `src/photo/assetSources.ts`
- [ ] `window.__photobooksProject` / `__photobooksE2e` exposure is compile-time only (no runtime switch)
- [ ] `scripts/assert-dist-clean.mjs` in `checks`: the deploy `dist/` contains no fixture markers; LHCI audits the deploy build
- **Done when:** `pnpm build` output has no painter fixture or test-hook code and `?fixture=painter` there loads the normal session, the e2e build still supports it with all specs green, and the dist check fails when a marker is reintroduced.
- **Size:** ~500 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #47; BRIEF §8
