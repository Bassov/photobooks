## Decisions

1. Progressive display in `tierDisplay`: allow `queueTierSwap` / pump to publish a tier when `tier === desired` **or** `tier < desired` and it improves on `shown` (none or lower). Exact-match upgrades still replace after decode; never flash empty when a worse live URL exists.
2. On spread mount, after requesting the covering tier, also queue any **already cached** ladder steps ≤ desired (`IMAGE_TIERS` + `getTierUrl`) so a lower hot URL shows before the covering encode/decode finishes.
3. Keep `resolveSpreadPreviewUrl` order (shown tier → book preview → thumb). No new UI tokens; decode stays off main thread via existing worker path.

## Touch-set & Test Plan

- Files: `src/editor/tierDisplay.ts`, `src/editor/ConnectedSpreadView.tsx`, `src/editor/spreadPreviewKeys.ts` (helper if needed), unit tests; `openspec/specs/image-tiers/spec.md` (+ delta).
- Reuse: `IMAGE_TIERS`, `getTierUrl` / `queueReadyTierIfCached`, existing thumb fallback.
- Tests (primary lock = unit / ConnectedSpreadView): progressive swap (desired high + cached lower → lower then upgrade); remount with only lower cached → non-blank filled `src`; empty frame stays placeholder. No new e2e in this change.
- UI smoke: skill `ui-review` at stage 9 (display pipeline only; no chrome tokens).
