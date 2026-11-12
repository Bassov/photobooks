# site-texts-kit

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item site-texts-kit

## Scope

K3 of the personal-site Designer Spec (orch `shared/design/personal-site/spec.md` § "K3 site-texts-kit + retire the old
site", decision D37). Kit only.

- [ ] `uikit/src/demo-parts/settings.tsx` Site rows: Site title, Author and **Intro** (label "Intro" + hint "The first lines of your site"; value `text-sm text-muted-foreground`, right-aligned, max-width 320, 2-line clamp, or "Not set"); `uikit/src/demo-parts/session.tsx`: demo state `site` (title, author, intro; sample intro from the Spec)
- [ ] the kit site home lead reads it per D37: `intro`, else `Photobooks by {author}.`, else no lead (the case moves up to the lead's top)
- [ ] delete `uikit/src/features/site-photographer.tsx`; cut `uikit/src/features/site-viewer.tsx` to the lightbox (`Fullscreen`) and what it needs; drop the `site-viewer` / `site-photographer` entries from `uikit/src/kit/pages.json` and `uikit/src/features/pages.tsx`; `site-lightbox` stays and opens from the room
- [ ] `uikit/scripts/qa.mjs`: the old site smokes become room → Fullscreen → lightbox; the lightbox smokes keep the entry `site-fullscreen-btn`
- **Browser check:** kit `#/full/site-settings` scenario Site: the Intro row with the sample text in at most 2 lines; an empty intro (seeded in `#/demo`) reads "Not set"; `#/demo` Open site: the home lead is the intro.
- **Done when:** e2e pins the Intro row (paint check: the value clamps at 2 lines, "Not set" when empty) and the home lead per D37 (intro / `Photobooks by {author}.` / no lead); no route or page entry references site-viewer or site-photographer; uikit typecheck + qa smokes green.
- **Hard nos:** no `src/**`; no backward compat (Owner 2026-11-02)
- **Test:** Playwright e2e against the kit; uikit typecheck + qa
- **UI kit:** `uikit#/feature/site-settings`
- **Source:** Designer Spec `personal-site` K3, D37
