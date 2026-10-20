# reimport-loaf-store-thumb

Tag: prep
Milestone: M2.1
Title: Re-import LoAF: no-op bookStore meta/patch + thumb put dedupe

## Scope

- [ ] `patchAssetRecord` / identical `sessionMeta` flush no-ops in `bookStore` (no emit / aspects invalidate)
- [ ] Dedupe DerivedCache thumb puts by contentHash in `thumbCache`
- [ ] Unit tests; mutation on these files ≥85 with 0 NoCoverage (or extract helpers into small modules that clear the bar)
- **Done when:** library re-import scroll LoAF stays 0 under existing e2e; `pnpm stryker:diff` green for the touched store/cache modules; budgets unchanged
- **Size:** ~400 lines
- **Source:** overflow from ci-flake-hardening (whole-file mutate of bookStore/thumbCache dragged score below 85)
