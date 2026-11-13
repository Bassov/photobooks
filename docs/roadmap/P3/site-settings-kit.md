# site-settings-kit

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item site-settings-kit

## Scope

Kit part (Item 1 of 4) of Settings → Site from the Designer Spec `site-settings` (Decisions S1–S8, § Spec (kit = prod), § Kit changes; mockup `site-settings/mockup.png`): the editable Site card and the site Dark theme in the kit. Lane: `uikit/**` plus the kit e2e that covers it; no `src/**`, no `uikit/scripts/demo-capture.mjs`, no `#/demo` step or baseline change.

- [ ] `SiteTexts.theme: "light" | "dark"` (sample Light); Settings → Site is the editable card (Site title, Author, Intro textarea ≤ 160 with a `n / 160` counter, Theme radiogroup of two 120 × 75 miniature tiles), state from the session, `SettingsScreen` `onSite?`
- [ ] Dark switches the kit site (home, room, editor Preview) to `ss-dark` incl. html/body bars; the editor Preview reads the session's site texts
- [ ] Feature page scenarios: site-settings `site`, `site-empty`, `site-dark` (+ 2 notes lines); personal-site `dark`
- **Done when:** K1 row heights 68.8 / 68.8 / 115.3 / 124.5 (±0.5) at the Settings width in the Hosting field-row look (Inter 13), placeholders = fallbacks (S3), counter `n / 160` turns `#393738` 500 at ≥ 150; K2 Theme tiles are a radiogroup with arrow keys and M82 tile states (hover ring .22 + lift, selected 2 px `#232223`, focus-visible 2 px outline offset 3), miniature geometry as the Spec; K3 commit on blur / Enter, Esc reverts, a pasted newline becomes a space, Dark paints the kit site `#111110` incl. html/body, Light is unchanged (no `#/demo` baseline change).
- **Browser check:** `#/full/site-settings` Site / No values / Dark tabs: type, Esc, Enter, arrow through the tiles; `#/demo` Settings → Site → Dark → Open site and editor Preview paint dark.
- **Hard nos:** no `src/**`; no `#/demo` step or baseline change; no backward compat (Owner 2026-11-02).
