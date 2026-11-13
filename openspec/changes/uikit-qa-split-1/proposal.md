## Proposal

Roadmap: `docs/roadmap/P3/uikit-qa-split-1.md` (scope / Done when / split map SoT).

### Scope out

- Kit or product code (`uikit/src/**`, `src/**`), playwright config, non-`kit-*` specs.
- qa.mjs blocks after line 648 (split-2…split-6 per the map).

### Delta / Risk

- Test move only: 27 `ok()` + 18 smoke calls leave qa.mjs for 5 `e2e/kit-*` specs; totals sum back to 349.
- Never-asserted code (credits caption `bad` list, `fitAir`, `fr`) is dropped, not ported.
