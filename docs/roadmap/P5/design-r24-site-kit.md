# design-r24-site-kit

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item design-r24-site-kit
Status: done

## Scope

- [x] M108: a book URL loaded directly in the kit (`#/full/personal-site?book=<id>`, `#/demo` `siteEntry=book`) opens on "Cover" and rests there (no cover turn), at 1440 × 900 and 390 × 844, like prod (spec D41 / D42, prod `e2e/site-final.spec.ts`). A kit page state naming a slide still opens that page.
- [x] M109: the kit editor Preview (`#/demo` step `editor-preview`, kit page `site-preview-mode`) opens on "Cover" (Owner Must M53); the demo-capture comment follows.
- [x] A home tap keeps opening at the cover and turning it (D23); `e2e/kit-personal-site.spec.ts` `expectOpened` stays green.
- **Done when:** kit e2e: direct load of a book hash at 1440 and 390 shows "Cover"; a kit page state naming a page opens that page; `#/demo` Preview shows "Cover"; `uikit:qa:quick` green.
- **Browser check:** 1440 × 900 and 390 × 844: open `/uikit/#/full/personal-site?book=lake-trip`, wait 1 s, the label reads "Cover"; `#/demo` → create a book → Preview, the label reads "Cover".
- **UI kit:** `uikit/src/features/site/sys.tsx`, `uikit/src/features/site-book/room.tsx`, `uikit/src/demo-parts/site.tsx`. UI ref: `uikit#/demo`.
- **Source:** Designer parity personal-site 2026-11-13 (M108, M109), tracker Round 24.
