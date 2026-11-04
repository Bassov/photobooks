## Implementation

- [x] 1. Prod picker shape filter + Save with `pages` + shape-aware header note (`LayoutSection.tsx`); unit tests — `LayoutSection.saved.test.tsx` "a template belongs to its page shape"
- [x] 2. Dedup helper + flash (`savedTemplates.ts`, `LayoutSection.tsx` / `.css`); unit tests — "Save never duplicates", `findSameSavedTemplate` store test
- [x] 3. Announcements (save / rename / duplicate / delete / dedup / failed write) + rename `maxLength` 60; unit tests — store "announces …", "a refused / thrown library write is announced"
- [x] 4. e2e: kit seed counts on spread 2–3, page-1 empty copy, page-1 template on page 1 + last page only, Save twice → one template + flash — `e2e/design-r2-layout-picker.spec.ts` (18 passed)
- [x] 5. Kit `templates.ts` / `context-inspector.tsx`: pages, custom without `pageFrames`, save on page, dedup + flash, Save disabled, menu hidden at rest, maxLength — kit qa 377 passed
- [x] 6. Kit demo step `editor-page1-my-templates` + qa probes re-checked — demo walk 71 steps, step 21

## Manual test scenarios

1. Page 1 → My templates tab: 0, "No templates yet. Save a page you like."
2. Save on page 1, open the last page: the template is listed; spread 2–3: it is not.
3. Spread 2–3: Save, Enter, Save again → My templates 1, the tile flashes.

manual-qa (2026-11-05): harness problem — start-session click intercepted by the welcome-screen header (2 attempts, load ~35); no scenario ran. Covered by e2e instead (`e2e/design-r2-layout-picker.spec.ts`, 18 passed): 1 → "page 1 offers no two-page template: My templates 0 asks for a page"; 2 → "a template saved on page 1 is offered on page 1 and the last page, not on spread 2–3"; 3 → "saving the same layout twice keeps one template and flashes its tile" (`data-flash`, hover ring + lift, then idle).
