# personal-site-kit-port

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item personal-site-kit-port

## Scope

Item K1 of the Designer `personal-site` Spec (Owner ask 2026-11-11 18:59, D34, D35, D43): the stand's demo 9 bookcase
v8 (origin/fix/site-stand af8369bb) becomes the UI kit's personal site, a new kit page `personal-site`. Kit-only;
a verbatim port of reviewed stand code (over the 6-file rule on purpose: splitting it leaves dead half-imports).

- [ ] `uikit/src/features/site-book/**` as in af8369bb: room, reader, slides, turn, book3d, book3d-css, paper, many + css, `gl/{three,closed,open,curl}.ts`, `gl/vendor/*`
- [ ] `site-sys/{sys.tsx,system.css}` → `uikit/src/features/site/{sys.tsx,system.css}`; `site-demo-9/{site.tsx,shelf.ts,site.css}` → `features/site/{home.tsx,shelf.ts,home.css}`; `site-demo-1/{data.ts,data-extra.ts,art.tsx}` → `features/site/{sample.ts,sample-extra.ts,art.tsx}`
- [ ] New kit page `personal-site` in `uikit/src/kit/pages.json` (Spec entry) + `features/pages.tsx` with scenarios books 1 / 3 / 6 / 12 / 30 / 100 (`?books=` stays the URL parameter)
- [ ] Font per D43: "Site Inter Display", Inter wght + opsz, latin / latin-ext / cyrillic subsets with the `fonts.css` unicode-ranges, copied from `@fontsource-variable/inter` 5.x into `uikit/src/fonts/` (no new runtime dependency; the stand's Latin-only `inter-opsz.woff2` is not ported)
- [ ] Hand edits (D35): `final` and every `!final` branch removed; the Books switch removed from `SysSite`; test-id renames from the Spec ("Test ids"); the font-face
- [ ] e2e: the demo-9 cases of `e2e/kit-site-stand*.spec.ts` (af8369bb) → `e2e/kit-personal-site*.spec.ts` (demo-6 cases dropped); the stand's `uikit/scripts/qa.mjs` site-book scans
- **Not ported:** `site-demo-6/*`, `site-demo-1/{v2,entry,reader,book3d}*`, `site-demos`. The old kit site (`site-viewer`, `site-photographer`) stays (later items retire it). Share / Fullscreen buttons are `personal-site-kit-demo`.
- **Browser check:** kit `#/full/personal-site?books=6` at 1440×900: the bookcase home under the lead; a click opens the reading room with the GL book, the foot row (about · pager · Play). At 390×844 the phone room opens in Page turn.
- **Done when:** kit `#/full/personal-site?books=6` matches the Spec checkpoints ±0.5 px at 1440×900 (home lead 141.33 / 104 w 640; case 141.33 / 206.38, 1157.33 × 572.44; room foot top 846, pager centre 720, Play right 1416) and 390×844 (room header y 128.25, stage top 180.25), asserted in the ported e2e; the case is the same width at books 1, 3, 6, 12; html / body / theme-color are rgb(244, 243, 240) while mounted and restored on unmount; a Cyrillic name renders in "Site Inter Display" (`document.fonts.check`); ported e2e green 10× burn-in; uikit qa green
- **Hard nos:** no `src/**` (prod), `uikit/src/demo-parts/**`, `uikit/src/sandbox/store.tsx`, `e2e/settings-profile-fields.spec.ts`; no redesign of the stand code; no backward compat (Owner 2026-11-02)
- **Test:** ported Playwright e2e (paint checks via clipped screenshots); uikit typecheck + qa; no unit tests (kit code is not under `src/`)
- **UI kit:** `uikit#/feature/personal-site`
- **Source:** Designer Spec `personal-site` (orch `shared/design/personal-site/spec.md`): D34, D35, D43, "Spec", "Test ids", "Checkpoints", "Kit changes" K1
