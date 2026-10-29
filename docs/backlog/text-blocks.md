# text-blocks

Tag: feature
Milestone: backlog (held 2026-10-30; target P2)
Title: captions

## Scope

- [ ] Text frames with inline editing; built-in styles (title, caption, body)
- **Perf:** fonts preloaded before first measure; typing re-renders only the edited text frame. Gate: type 200 characters fast — INP ≤ 100 ms.
- **Browser check:** add a caption, edit it inline; it renders the same in the workspace and in spread thumbnails.
- **Kit-first:** yes. Held in `docs/backlog/` (Designer call B1, 2026-10-30) until its kit page lands; then the Owner re-adds it with `pnpm roadmap add <slug> --after <X>` and the Reviewer fills in Kit components / Demo / Musts.
- **Kit reference:** `TextSection` (`uikit/src/sandbox/sections.tsx`) is the reference (Designer call D4); Designer adds a `text-blocks` kit page before the build.
- **Kit components:** none, **kit-first**: Designer adds the kit page (`text-blocks`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first)
- **Musts:** captions as text frames
- **Hard nos:** no text UI before the kit page
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** text-frame-model
- **UI kit:** none (no matching component); kit-first
