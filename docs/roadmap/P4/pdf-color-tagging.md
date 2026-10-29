# pdf-color-tagging

Tag: prep
Milestone: P4
Title: keep photo colors

## Scope

- [ ] Source ICC profile kept on image XObjects (sRGB tag when untagged); preflight warns on non-sRGB sources (Adobe RGB, Display P3) for sRGB profiles
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI); perf scenario only where Scope names one
- **Depends:** pdf-painter
