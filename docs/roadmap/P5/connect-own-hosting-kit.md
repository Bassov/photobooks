# connect-own-hosting-kit

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item connect-own-hosting-kit
Status: done

## Scope

Kit part (item 1 of 4: kit, relay, core, UI) of the Designer `connect-own-hosting` spec (2026-11-14; Decisions C1–C10, § Layout, § Kit changes): guided Cloudflare setup in Settings → Hosting (setup token → address → Set up). Owner Q-16 2026-11-14 13:22: setup goes through a relay on our Worker. Kit only (`uikit/**` + the two kit e2e specs); relay, core and prod UI are later items.

- [ ] New `uikit/src/demo-parts/hostingSetup.tsx` (≤ 300 lines): `HostingSetup` card, three steps (Connect your Cloudflare account · Choose the site address · Set up), simulated: Continue 900 ms; tokens `r2off…` → R2 off, `nozone…` → no active domain (pending `mybooks.org`), `noperm…` → missing API Tokens · Edit; Set up rows 600 ms each; subdomain `taken` → row 3 DNS failure, `keep` → row 6 warns (C10).
- [ ] `uikit/src/demo-parts/hosting.tsx`: not-connected renders `HostingSetup` by default; `hosting-manual` / `hosting-guided` mode links; new intro; connected card lines (Set up automatically, New address, setupTokenLeft); Forget returns to the record's origin.
- [ ] `uikit/src/demo-parts/session.tsx`: `HostingRecord` gets `origin?`, `provisionedAtMs?`, `setupTokenLeft?` (`SAMPLE_HOSTING` stays manual).
- [ ] `uikit/src/features/pages.tsx` `site-settings`: scenarios `hosting-empty` (setup step 1), `hosting-setup-checking`, `-r2off`, `-address`, `-nozone`, `-running`, `-failed`, `-done`, `hosting-manual`; edge lines "The setup token is never stored", "Only a key for one bucket is kept".
- [ ] Kit e2e: `e2e/kit-hosting-settings.spec.ts` (fresh-form tests click `hosting-manual` first; new setup checks), `e2e/kit-in-app-publish.spec.ts` (Open Settings → Hosting lands on `hosting-setup`).
- **Browser check:** kit `#/full/site-settings` at 1440 × 900: step header 52, markers 20 × 20, fields h 32, Continue width stable through Checking… (±0.5 px, DOM measured); markers and the failed row colour checked by paint.
- **Hard nos:** no `src/**`, `wrangler.jsonc`, `uikit/scripts/qa.mjs` (frozen) or `#/demo` step / baseline change; no provider select (C5); no blue / teal; no page-level H/V scroll.
- **UI kit:** `uikit#/feature/site-settings` hosting scenarios above.

## Done when

- K1: setup card steps 1–2 with the R2-off, no-domain and token-error states; step header 52 px, markers 20 × 20 (current #232223, done #D7D7D7 + Check, future ring), fields h 32; Continue width stable through Checking… (±0.5).
- K2: step 3 progress rows (pending / running / done / failed, failed text #a8403a); Try again resumes at the failed row; Cancel setup → step 2; connected card lines incl. the setupTokenLeft line.
- K3: manual / automatic switch, intro text, Forget returns to the record's origin, all `site-settings` scenarios render; paint check for the markers and the failed row colour.
