# editor-hidpi-photos

Tag: feature
Milestone: P2
Title: Bug: photos in the book editor look soft on 4K / HiDPI screens and visibly upgrade after a drop
Status: done

## Scope

- [ ] HiDPI tier **2560 long edge** (WebP, same worker pipeline and DerivedCache as 1280); ladder 1280 → 2560 per frame from `needEdge = frameLongEdgeCssPx × devicePixelRatio × zoom` (smallest tier ≥ need; above 2560 stay on 2560; never 2560 for a source ≤ 1280 px). DPR 1 and small frames stay on 1280.
- [ ] No visible swap: the shown tier stays until the higher one is decoded; an asset drag starts the 1280 work on dragstart and the drop target's tier on hover, before the drop lands.
- [ ] Each caller that chooses thumb vs working preview is listed in the PR body (changed, or left out with a reason); spread thumbnails stay thumb-only.
- **Perf:** decode / encode off the main thread; 2560 jobs rank below visible 1280 jobs; released holds abort in-flight tier jobs; PERF_BUDGETS unchanged.
- **Browser check:** at DPR 2 a full-bleed page photo has natural width ≥ 2× its CSS width (cap 2560); at DPR 1 it stays 1280; after a drop the frame image never goes blank between tiers.
- **Test:** unit tier choice (DPR 1 / 900 css → 1280; DPR 2 / 900 → 2560; DPR 2 / 300 → 1280; source 2000 → output ≤ 2000); e2e at deviceScaleFactor 2 and 1; e2e drop sampler (no `naturalWidth 0`, src changes ≤ once per tier).
- **Lane:** off limits `uikit/`, `frameSelection.ts`, `frameGesture.ts`, `Pasteboard.tsx` gestures, `Inspector*`, `src/editor/LayoutSection*`, parent-spreads files; `SpreadView.tsx` only for the image source choice.
- **UI kit:** none (bug fix: preview resolution only, no new UI)
- **Brief:** Owner 2026-11-03 (4K screen: photos soft in the editor, visible upgrade after a drop); orchestrator picks 2560.
