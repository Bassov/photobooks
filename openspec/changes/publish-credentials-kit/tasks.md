## Implementation

- [x] 1. `hosting.tsx`: validation helpers, form (five fields, hints / errors, footer note / alert, Connect width-stable, readOnly while checking, Enter = Connect) and the simulated check. — `e2e/kit-hosting-settings.spec.ts` KM1 (form, format errors, endpoint URL, Connect → Checking…)
- [x] 2. `hosting.tsx`: connected card (badge + time, rows, actions), Replace (prefill, focus key, Cancel), Forget AlertDialog (focus Account ID), help card (5 steps, CORS JSON + Copy, step 3 mark). — KM2 tests + KM1 CORS test
- [x] 3. Session `hosting` state, root `settings.hosting` seed, settings hosting branch, PublishDialog host. — KM3 test
- [x] 4. `pages.tsx` scenarios `hosting`, `hosting-empty`, `-invalid`, `-checking`, `-cors`, `-recheck-failed`, `-replace`, `-forget` + edge lines. — every scenario opened by the spec
- [x] 5. `e2e/kit-hosting-settings.spec.ts` (KM1–KM3, security, paint). — 11 passed; `pnpm check:fast`, `uikit:qa:quick` 425/425

## Manual test scenarios

1. Kit `#/full/site-settings` 1440×900, Hosting: connected card; Replace token… → form, key/secret empty, Cancel returns.
2. Forget token… → confirm → empty form + help; type a bad account ID → red ring + text; fill valid values → Connect → Checking… → connected.

Results (kit-only: agent manual-qa drives the prod editor, not the kit; walked through Playwright on the built kit at 1440×900):

- OK 1: connected card matches mockup panel 6 (screenshot checked); Replace → key/secret empty, focus on key, Cancel keeps the record (`kit-hosting-settings` KM2 Replace).
- OK 2: Forget → trash-tile confirm → empty form, focus Account ID, help shown; format errors red ring (paint probe); Connect → Checking… same width → connected; secret absent from outerHTML / URL (KM1, KM2 Forget).
- OK ui-review: labelled fields, focus ring, reduced-motion loader, errors = text + icon + ring, one primary CTA; scenario strip fits 1440. `uikit:qa:quick` 425/425, 0 console errors.
