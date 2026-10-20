## Implementation

- [x] 1. Relink status store + detect-on-open (missing when no live File) with public API tests
- [x] 2. Rescan orchestration: pick folder → worker scan → hash entries → `matchAssets` → rAF progress; apply patches + retain Files; unit tests
- [x] 3. RelinkDialog + missing pill UI (problems list, Rescan, Skip, Resolve) + CSS tokens — tabs / Locate… / Use new version deferred to `missing-assets-relink-actions` / `missing-assets-relink-dialog-polish`
- [x] 4. Hatched missing frames in SpreadView + wire RelinkHost from editor chrome (thin)
- [x] 5. Spec deltas: editor-shell missing-assets / remove reattach-out-of-scope; hatch note if needed
- [x] 6. E2E: empty / happy rescan+Resolve / filmstrip scroll during rescan (LoAF) + viewport/scrollport asserts
- [x] 7. `ui-review` + Manual check scenarios
- [x] 8. Verify gates; list any stryker survivors under this item if not fixed

## ui-review

- [pass] design system — RelinkDialog/pill/hatch use Theme B tokens (`--card`, `--foreground`, `--badge-*`, `--text-*`, `--radius-*`); no parallel colour system
- [pass] a11y — pill `role="status"`; dialog `role="dialog"` `aria-modal` `aria-labelledby`; Skip/Rescan/Resolve labeled buttons; status not colour-only (badge text)
- [pass] states — Resolve/Rescan disabled while scanning or empty found set; empty list copy
- [pass] layout smoke — e2e empty dialog + happy rescan+Resolve + filmstrip scrollport; LoAF 0 during rescan scroll
- [pass] anti-slop — no purple gradient / Inter-only hero; chrome uses `--font-ui` / `--font-heading`

## Manual test scenarios

```
OK Save a library-backed book with hashed photos; move/rename the photo folder; reopen → missing pill + dialog + hatched frames. (e2e: reload → pill + dialog + row missing; hatch unit/RTL)
OK Rescan the moved folder → progress updates without jank; Resolve → frames and thumbs restore; crop kept. (e2e rescan+Resolve; crop unit via apply)
OK Skip for now → dialog closes; pill remains; filmstrip still scrolls. (e2e skip + filmstrip scrollport)
OK Hash mismatch never silently replaces a photo without Resolve. (unit locateMissingAsset)
OK filmstrip scroll while rescan: 0 LoAF (e2e)
```

5. (Follow-up) Modified file at same path → Use new version — `missing-assets-relink-actions`.

## Stryker survivors (accepted under this item)

Survivors remain mainly in thin React chrome (`RelinkDialog`/`RelinkHost`/`autoDetect`) and optional-chaining/object-literal noise in `rescan.ts`; score ≥85 with 0 NoCoverage. Deferred Locate/Use-new UI is out of mutate surface for this cut.
