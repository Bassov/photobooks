## Decisions

1. **Back text default in core.** `defaultCover(title)` sets `back.text = title` (kit `blankExtras`). `CoverCanvas` already draws it, and `.cover-back-text` already matches the rendered kit (`--cover-ink`, insets 12 % / 10 %), so no CSS change. Stored books keep their text; `migrateV4ToV5` reuses `defaultCover`, so v4 documents now get back = title (intended).
2. **Spine width = rendered `#/demo`:** read-only mono "N mm" from the stored `spineWidthMm`; slider removed. `setCoverStyle` clamping stays on purpose (stored documents, migration).
3. **Pages = rendered `#/demo`:** pill + "20–120" hint + note (strings in the spec delta). `PAGE_MIN`, `PAGE_MAX`, `pagesNote` go in `editorChromePanels.ts` beside `pagesOf` (mutation-tested).
4. **Book settings subtitle** (step 24): `back || front || "Untitled book"` + " · applies to the whole book"; the section also reads cover text.

## Touch-set & Test Plan

- Files: `src/core/cover.ts`, `src/editor/{CoverSection,BookSettingsSection,editorChromePanels,editorChromeTokens}`, their tests, `migrate.test.ts`; e2e `design-r3-book-cover.spec.ts`; slider-driving specs (`design-inspector-book-cover`, `design-filmstrip-cover`) move to the kit text.
- Reuse: `InspectorRow`, `ReadOnlyPill`, `fmtN`, tokens `FIELD`/`SUB`/`T`.
- Unit: `pagesNote` at 0/18/20/120/122+ pages, plural edge; `defaultCover`; subtitle fallbacks.
- e2e: happy (back text, spine "12 mm", Pages 6), interact (edit back text; add spreads → note updates). Skill `ui-review` before push.
