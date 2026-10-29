# library-json-schema

Tag: prep
Milestone: P2
Title: `library.json` versioning

## Scope

- [ ] `library.json` gets `schemaVersion` + migration chain (the first item to change `library.json`)
- **Done when:** v0 → v1 migrates every fixture; parse / migrate PBT green
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI)
- **Depends:** none
