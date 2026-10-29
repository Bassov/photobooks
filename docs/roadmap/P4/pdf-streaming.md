# pdf-streaming

Tag: contingency
Milestone: P4
Title: only if `pdf-export` peak memory is too high

## Scope

- [ ] Per-page chunks streamed to the file
- **Browser check:** a 40-spread export's peak memory stays below the threshold recorded in `pdf-export`.
- **Kit components:** none (contingency, no UI)
- **Demo:** n/a
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** pdf-export
