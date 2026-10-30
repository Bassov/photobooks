# cover-endpaper-schema

Tag: prep
Milestone: P1
Title: cover and endpapers in the document
Status: done

## Scope

- [ ] Schema version bump with migration: cover (front / spine / back: photo + text) and front / back endpapers in the document; a new book's cover text is its title
- **Done when:** schema vN migrates every vN-1 fixture; a new book's cover text is its title; parse / migrate PBT green
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI; no print fields (P4 `print-model-schema`)
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI)
- **Depends:** none

## Done note

schema v5: cover + endpapers, v4→v5 migration
