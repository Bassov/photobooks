# recents-home-captions

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item recents-home-captions

## Scope

The credits block of the frozen `uikit/scripts/qa.mjs` (v0.6.0, lines 539–550 before #594) built a chrome-caption `bad` list and never asserted it; ported as an assertion in uikit-qa-split-1 (#594) it failed on `#/feature/recents-home`, so it was dropped (reviewer note on #594). Assert it here for every `#/feature/*` kit page and fix every page that fails. Lane: `uikit/src/**` page/component files the fix needs + `e2e/kit-chrome-captions.spec.ts`. No `uikit/scripts/qa.mjs`, `src/**`, #603's kit specs, `uikit/src/demo-parts/{dialogs,editor}.tsx`, `uikit/src/features/pages.tsx` or `uikit/scripts/demo-capture.mjs`.

- [ ] Kit recents-home: no chrome captions; chrome-caption check asserted for every feature page
- **Done when:** `e2e/kit-chrome-captions.spec.ts` runs the old list's checks (no credit inside the demo; exact "Photo: … · licence · modified" text, Commons + licence hrefs, 11px #535152, outside the demo) on every `#/feature/*` page and asserts them; every failing page is fixed or listed in the PR body with a reason; no visual change beyond removing offending captions (a design choice the kit does not make → stop and say so in the PR).
- **Browser check:** N/A (kit e2e; the spec checks paint of every chrome caption with `elementFromPoint`).
- **Hard nos:** no backward compat (Owner 2026-11-02).
