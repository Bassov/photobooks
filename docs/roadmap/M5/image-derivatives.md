# image-derivatives

Tag: prep
Milestone: M5
Title: web image pipeline

## Scope

- [ ] Worker pool: resize presets from config, native JPEG / WebP encode, sRGB
- [ ] Cache via `DerivedCache` by `(assetHash, presetId)`; benchmark
- [ ] Derivative jobs at the lowest priority; scenario: edit with drag while derivatives encode — zero LoAF
