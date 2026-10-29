# print-model-schema

Tag: prep
Milestone: P4
Title: print settings and cover in the document

## Scope

- [ ] Schema version bump with migration: book references a print profile (id + overrides); print fields on the cover from `cover-endpaper-schema` (spine width source); trim and bleed stay user values that the profile validates
- **Done when:** book carries `printProfile {id, overrides}`; migrate / parse PBT green
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI); perf scenario only where Scope names one
- **Depends:** none
