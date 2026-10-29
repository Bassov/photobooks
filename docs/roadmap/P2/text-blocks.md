# text-blocks

Tag: feature
Milestone: P2
Title: captions

## Scope

- [ ] Text frames with inline editing; built-in styles (title, caption, body)
- **Perf:** fonts preloaded before first measure; typing re-renders only the edited text frame. Gate: type 200 characters fast — INP ≤ 100 ms.
- **Browser check:** add a caption, edit it inline; it renders the same in the workspace and in spread thumbnails.
- **Kit-first:** yes. Not buildable until the kit page exists (Designer); `roadmap next` must skip it until then.
- **Kit components:** none, **kit-first**: Designer adds the kit page (`text-blocks`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first)
- **Musts:** captions as text frames
- **Hard nos:** no text UI before the kit page
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** text-frame-model
- **UI kit:** none (no matching component); kit-first
