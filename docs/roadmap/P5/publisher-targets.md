# publisher-targets

Tag: prep
Milestone: P5
Title: generalize publishing

## Scope

- [ ] `Publisher` interface with target capabilities; the M7 path becomes one target
- [ ] Contract tests shared by all targets
- **Done when:** publishing goes through a target interface with the current host as the only implementation; unit tests green
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI); perf scenario only where Scope names one
- **Depends:** in-app-publish
