# site-settings-kit

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item site-settings-kit
Status: done

## Scope

Kit part (Item 1 of 4) of Settings → Site from the Designer Spec `site-settings` (Decisions S1–S4, S7–S8, § Spec (kit = prod), § Kit changes; mockup `site-settings/mockup.png`): the editable Site card in the kit. The site has one look: Theme / Dark (S5 / S6) are cancelled (Owner 2026-11-13), so the kit's unreachable dark look goes too. Lane: `uikit/**` plus the kit e2e that covers it; no `src/**`, no `uikit/scripts/demo-capture.mjs`, no `#/demo` step or baseline change.

- [x] Settings → Site is the editable card (Site title, Author, Intro textarea ≤ 160 with a `n / 160` counter), state from the session, `SettingsScreen` `onSite?`; the editor Preview reads the session's site texts
- [x] Feature page scenario site-settings `site-empty` (+ 2 notes lines)
- [x] The kit's dead dark look is removed (`.ss.ss-dark`, `.sd-dark`, the GL `dark` option, `SiteProps.dark`)
- **Done when:** K1 row heights 68.8 / 68.8 / 115.3 (±0.5) at the Settings width in the Hosting field-row look (Inter 13), placeholders = fallbacks (S3), counter `n / 160` turns `#393738` 500 at ≥ 150; no Theme row; K3 commit on blur / Enter, Esc reverts, a pasted newline becomes a space; the kit site keeps its one light look `#f4f3f0` incl. html/body (no `#/demo` baseline change).
- **Browser check:** `#/full/site-settings` Site / No values tabs: type, Esc, Enter; `#/demo` Settings → Site → edit the intro → editor Preview shows it.
- **Hard nos:** no `src/**`; no `#/demo` step or baseline change; no backward compat (Owner 2026-11-02).
