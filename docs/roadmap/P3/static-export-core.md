# static-export-core

Tag: prep
Milestone: P3
Title: deterministic site tree

## Scope

- [ ] Prerendered HTML via `react-dom/server`, viewer bundle, derivatives, manifest; deterministic output
- [ ] Only published books, using their frozen revision
- **Done when:** the same book twice yields a byte-identical site tree (snapshot); PBT green
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI); perf scenario only where Scope names one
- **Depends:** image-derivatives
