# unsupported-browser

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item unsupported-browser
Status: done

## Scope

- [x] Kit: `UnsupportedScreen({ variant, browserName })` in `uikit/src/features/unsupported.tsx`, a `#/demo` stage `unsupported` (`__demo.unsupported(variant = "other", browserName = "Safari")`), three `demo-capture` steps (`unsupported-other`, `unsupported-no-api`, `unsupported-mobile` at 390×844); dead `--radius-device` and the stale settings comment removed
- [x] Prod: `UnsupportedBrowserScreen` rebuilt to the Designer spec with hand CSS (`UnsupportedBrowserScreen.css`, no reliance on preflight; every anchor class sets its own colour and `text-decoration`): in-flow kit `Mark` header, Lora 400 title, pill CTAs (primary / secondary), browser list as pills without bullets, Brave flag as a one-line note, one narrow layout (< 640 px and every mobile variant); values kit = prod
- [x] Detection: mobile = `userAgentData.mobile` or UA `iPhone|iPad|iPod|Android` or `Macintosh` with `maxTouchPoints > 1`; browser name falls back to the UA (`Firefox`, `Safari`) when there are no brands
- [x] Global: `a { color: var(--foreground) }` moves into `@layer base` so layered utilities can colour links
- **Bug rule:** every `browserSupport` caller and every `<a ` / `AriaLink` / `Link` with a `text-*` colour utility is listed in the PR body as fixed / unchanged with a reason
- **Done when:** spec tests green (iPhone Safari, iPad Macintosh+touch, Android Firefox → mobile; Safari Mac → other "Safari"; Firefox → "Firefox"); e2e computed styles (Get Chrome rgb(242,242,242) on rgb(35,34,35), no underline; list-style none; title weight 400; 390×844 iPhone UA → mobile, no horizontal overflow); PR body has kit vs prod DOM numbers at 1440×900 and 390×844 and 320 px `docW == vw`; Designer review follows before merge
- **Perf:** N/A — static screen, no new work on the editor path
- **Browser check:** open `/` with `showDirectoryPicker` removed at 1440×900 and with an iPhone UA at 390×844: dark primary button with light text, pills without bullets, mobile variant on the phone
- **Hard nos:** no edits in `src/editor/EditorShell.css`, Inspector / FrameSections / FrameContextMenu files, `uikit/src/sandbox/inspector.tsx`, `context-inspector.tsx`, `pages.tsx`, `e2e/multi-select.spec.ts` (multi-select-inspector lane)
- **UI kit:** Designer spec `shared/design/unsupported-browser/spec.md` (2026-11-03); kit `#/demo` `__demo.unsupported(…)`
- **Source:** Owner report (iPhone + desktop), Q-4 decision 2026-11-03: one item, kit and prod together, Designer review before merge
