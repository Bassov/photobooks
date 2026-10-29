# preflight-core

Tag: prep
Milestone: P4
Title: pure preflight

## Scope

- [ ] Pure preflight with severities (error / warning / info) and fix-action ids: effective DPI, safe-zone intrusion, bleed hazard, empty frames, missing / modified assets, page-count rules
- **Done when:** each rule has a fixture that triggers it and one that does not; severities and fix-action ids are stable (snapshot); PBT: a book with no issues yields an empty list
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI)
- **Depends:** print-profiles
