# design-r3-chrome

Tag: feature
Milestone: P1
Title: Bug: design-r3-chrome: top-bar centring, filmstrip dock height
Status: done

## Scope

- [ ] M20 the top-bar tool group sits where the kit puts it: it hugs its tools (prod stretched it and left-aligned the tools, ~115 px left of the kit) and is centred in the free space between the left and right groups (kit `mx-auto`), with no overlap at 1440 and 1280.
- [ ] M26 the empty filmstrip dock is the kit 160 px (empty row = kit `--thumb` 104 px inside the strip's p-1 pb-2, text left), so the 19 × 23 cm Fit spread is 588 at 1440 × 900; with photos the dock stays the kit 132 px (76 px thumbs).
- **Done when:** e2e `design-r3-chrome.spec.ts` (group hugs its tools and is centred ±1 px between the groups at 1440 / 1280, no overlap; empty dock 160 / header 40 / Fit spread 588 with the 44/588 gap ratio; photos dock 132) passes with `--repeat-each=30`.
- **Browser check:** open a 19 × 23 book at 1440 × 900 next to kit `#/demo`: tools centred between the groups, dock top at y = 740 while empty.
- **Perf:** CSS / markup only; no new subscriptions or per-frame work.
- **UI kit:** `uikit/src/sandbox/chrome.tsx` (`TopBar`, `Dock`, `Filmstrip` empty state), `uikit/src/index.css` (`--thumb`); UI ref: `uikit#/demo`.
- **Source:** Designer round 3 verdict on prod 6300717, 2026-10-31 (M20, M26). M11 Print / Publish dropped by the Designer (features not shipped).
