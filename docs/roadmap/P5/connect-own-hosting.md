# connect-own-hosting

Tag: feature
Milestone: P5
Title: bring your own hosting (Security Review)

## Scope

- [ ] Guided connection of the user's own Cloudflare account with minimal scopes; automatic provisioning of site and storage
- **Browser check:** with a new Cloudflare account, connect and publish a site in one guided flow.
- **Kit components:** partial: `uikit/src/demo-parts/settings.tsx:12-56` `SettingsScreen` Hosting section (read-only Provider / Account / Token rows, owner only); missing: provider choice, credential entry, test connection, the flow for other users
- **Demo:** `uikit#/demo` steps 40, 49 (Settings → Hosting, owner only)
- **Musts:** bring your own hosting
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; no credential entry UI until Designer adds the connect form
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** publisher-targets, publish-credentials
- **UI kit:** partial: `uikit/src/demo-parts/settings.tsx` Hosting rows; missing: connect form
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
