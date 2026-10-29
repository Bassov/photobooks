# publish-revisions

Tag: prep
Milestone: P3
Title: draft vs published

## Scope

- [ ] `draft | published` status in `library.json` (no book schema bump; a `library.json` migration on the `schemaVersion` from `user-templates`), frozen `published.json` revision, pure "assets needed for the site"
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** none
