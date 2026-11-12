# publish-credentials-kit

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item publish-credentials-kit

## Scope

The kit Settings → Hosting section from the Designer Spec `publish-credentials` § Kit changes (Owner chose Cloudflare R2
2026-11-12). Kit-only: the connect check is simulated, nothing goes to the network.

- [ ] `uikit/src/demo-parts/hosting.tsx` (new): `HostingSection` with the form (five fields in Cloudflare order, as-you-type validation with the Spec regexes and texts, Connect → Checking… in one grid cell, fields readOnly while checking), the connected card (badge Connected / Can't connect + last-check time, site link, bucket, account, `…last4`, 12 dots secret; Forget token… / Check again / Replace token…), the help card (5 steps + CORS JSON with Copy) and the destructive forget AlertDialog
- [ ] `uikit/src/demo-parts/settings.tsx`: the hosting branch renders `HostingSection`; `uikit/src/demo-parts/session.tsx`: demo state `hosting` (default = connected sample `aleksandr-books`, `https://books.basov.photo`, `…9f2c`)
- [ ] `uikit/src/features/pages.tsx` site-settings scenarios `hosting`, `hosting-empty`, `hosting-invalid`, `hosting-checking`, `hosting-cors`, `hosting-recheck-failed`, `hosting-replace`, `hosting-forget`
- [ ] `uikit/src/demo-parts/dialogs.tsx`: PublishDialog "goes to {host}" from the stored site address
- **Browser check:** kit `#/full/site-settings` at 1440×900, scenario Hosting: connected card; Replace token… shows the form with key and secret empty; Forget token… → confirm → empty form with the help card; typing a bad account ID shows the error ring and text; a valid form → Connect → Checking… then the connected card.
- **Done when:** e2e `e2e/kit-hosting-settings.spec.ts` pins KM1 (nav Hosting at index 1, five fields in order, card max 640 / r 14, rows 52, field h 32 r 8, label 160, hint 12/16.8, invalid texts as you type, Checking… keeps the button width ±0.5 and fields readOnly, CORS scenario marks help step 3), KM2 (connected rows and badges, Forget dialog with the trash tile → empty form, Replace → Cancel changes nothing) and KM3 (help steps 5 + CORS JSON Copy → Copied, PublishDialog host from the site address); the typed secret is absent from `outerHTML` (incl. attributes) and the URL after Connect; paint check of the error ring colour via a clipped screenshot; uikit typecheck + qa green
- **Hard nos:** no `src/**`, `uikit/src/demo-parts/{site,siteBooks}.tsx`, room files, `#/demo` steps or demo baselines; no network in the kit; no backward compat (Owner 2026-11-02)
- **Test:** Playwright e2e against the kit (paint via clipped screenshots); uikit typecheck + qa
- **UI kit:** `uikit#/feature/site-settings`
- **Source:** Designer Spec `publish-credentials` (orch `shared/design/publish-credentials/spec.md`): D1–D10, Layout, Validation, Connected card, Help, Security rules, Kit changes
