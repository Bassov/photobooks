# image-derivatives

Tag: prep
Milestone: P3
Title: web image pipeline

## Scope

- [ ] Worker pool: resize presets from config, native JPEG / WebP encode, sRGB
- [ ] Cache via `DerivedCache` by `(assetHash, presetId)`; benchmark
- [ ] Derivative jobs at the lowest priority; scenario: edit with drag while derivatives encode — zero LoAF
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI); perf scenario only where Scope names one
- **Depends:** none
