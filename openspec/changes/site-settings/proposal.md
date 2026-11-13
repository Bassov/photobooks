## Proposal

Roadmap: `docs/roadmap/P3/site-settings.md`; Designer Spec `site-settings`; UI ref: `uikit#/feature/site-settings`.

### Scope out

- Theme (S5, S6): cancelled by the Owner 2026-11-13.
- Core (#584), `src/site/book/**`, `src/publish/**`, `uikit/**`, `renderSitePage.tsx`, `siteSystem.css`.

### Delta / Risk

- Session-only export now keeps the in-memory site settings (#584 gap); the embedded Preview shows the head name.
- Success: empty placeholders + `0 / 160`; set → reload keeps; Intro typing 0 LoAF. No page-level H/V scroll; scroll only inside `settings-scroll`.
