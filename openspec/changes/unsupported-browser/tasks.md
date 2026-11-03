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
