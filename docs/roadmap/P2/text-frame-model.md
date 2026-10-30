# text-frame-model

Tag: prep
Milestone: P2
Title: text in the document
Status: done

## Scope

- [ ] Schema version bump with migration: frame `kind` (image / text); text content (static or template); optional anchor to an image frame; built-in text style id; alignment; resolved text items
- **Done when:** vN migrates every v(N-1) fixture; text frame parse / migrate PBT green
- **Kit components:** none (prep, no UI); reference model: sandbox `uikit/src/sandbox/model.ts:43-70,181` (text frame factory `uikit/src/sandbox/model.ts:70`)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI); perf scenario only where Scope names one
- **Depends:** book-fonts
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
