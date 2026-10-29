# connect-own-hosting

Tag: feature
Milestone: P5
Title: bring your own hosting (Security Review)

## Scope

- [ ] Guided connection of the user's own Cloudflare account with minimal scopes; automatic provisioning of site and storage
- **Browser check:** with a new Cloudflare account, connect and publish a site in one guided flow.
- **Kit-first:** yes. Not buildable until the kit page exists (Designer). `roadmap next` does NOT skip it automatically: pass `--skip <slug>` (or the Owner holds it) until the kit page lands.
- **Kit components:** none, **kit-first**: Designer adds the kit page (`connect own hosting`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first; Settings → Hosting covers the owner only)
- **Musts:** bring your own hosting
- **Hard nos:** no UI before the kit flow
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** publisher-targets, publish-credentials
- **UI kit:** none (no matching component); kit-first
