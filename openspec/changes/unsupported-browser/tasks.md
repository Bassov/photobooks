## Implementation

- [x] 1. `browserSupport.ts`: mobile by `userAgentData.mobile` / UA / Macintosh + touch; UA browser-name fallback; Brave `flag`; unit cases per the spec — `browserSupport.test.ts` (`uaBrowserName`, `getBrowserSupport by user agent`)
- [x] 2. `unsupportedScreenModel.ts`: `chromeOutline` → `chromeSecondary`; model test — `unsupportedScreenModel.test.ts`
- [x] 3. Prod `UnsupportedBrowserScreen.tsx` + `UnsupportedBrowserScreen.css` rebuilt to the Designer spec (header, body, actions, pills, note, footnote, narrow rules); component test asserts the new classes — `UnsupportedBrowserScreen.test.tsx`
- [x] 4. `styles/app.css`: `a { color }` into `@layer base`; caller grep listed in the PR body
- [x] 5. Kit `uikit/src/features/unsupported.tsx` + byte-identical `unsupported.css` (drift test in prod), `#/demo` stage + `__demo.unsupported`, capture steps; dead `--radius-device` and stale comment removed — kit qa 327/0, capture 67 steps (65–67 unsupported)
- [x] 6. e2e `library-screens.spec.ts`: computed styles at 1440×900 (Get Chrome colours, no underline, list-style none, title 400), 390×844 iPhone UA → mobile, `docW == vw` at 320

## Manual test scenarios

1. `/` with `showDirectoryPicker` removed, Safari Mac UA, 1440×900: other variant, "Safari", dark primary pill with light text, browser pills without bullets, Copy link → Link copied.
2. Same at 390×844 with an iPhone UA: mobile variant, full-width Copy link, no horizontal scroll.
3. Kit `#/demo`, `__demo.unsupported("no-api")`: Reload primary + Get Google Chrome secondary, tips list.

`pnpm agent manual-qa` (2026-11-03): harness problem — its smoke clicks `start-session` on welcome (intercepted by the header) and cannot set a UA or remove the picker, so scenarios 1–3 could not run there. Evidence instead:

- 1 OK — e2e `unsupported browser page matches the kit spec on Safari at 1440×900` (Safari named, Get Chrome rgb(242,242,242) on rgb(35,34,35), no underline, list-style none, title 400 / 32 px, Mark 56,36) + `unsupported browser blocks when directory picker is missing` (Copy link → Link copied).
- 2 OK — e2e `unsupported browser shows the mobile variant on an iPhone at 390×844` (mobile, Copy link 20 / 350 × 44, docW == vw; 320 px case in test 1).
- 3 OK — kit capture `66-unsupported-no-api.png` + DOM dump: Reload primary 440,470 200×40, Get Google Chrome secondary, three tips; kit = prod.
