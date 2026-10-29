# avif-encoder

Tag: prep
Milestone: P3
Title: AVIF derivatives (Security Review: dependency)

## Scope

- [ ] AVIF (multithreaded WASM, needs cross-origin isolation) + fallback where configured
- [ ] Scenario: edit with drag while AVIF encodes — zero LoAF
- **Done when:** AVIF derivatives decode in Chrome / Safari fixtures; encoder runs in a worker; Security Review passed
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI); perf scenario only where Scope names one
- **Depends:** image-derivatives
