## Decisions

1. Pure `src/editor/liveCaption.ts`: chip titles, anchor options, token insert (caret or `·` append). Values come from core `resolveTextContent`, so chips and canvas agree.
2. Live block in `TextSection`: prod `ToggleSwitch` (new `disabled`), `Select`, chips with a new `braces` glyph. Tokens per Designer spec §Visual: chip `--chrome`, hover `--accent`, `--radius-md`, `--text-2xs` mono, icon `--muted-foreground`; switch `--toggle-off` / `--toggle-on`. Test ids `live-caption*`, `live-token-<name>`. Skill `ui-review` before push.
3. A chip is one step: `dispatchBookOp` takes an optional label, so `setTextLive` + `editText` share a key as "Insert token".
4. Text field and canvas edit show the template (`textEditStore`); painting stays resolved.
5. `TextNode` memo: a swap repaints only changed captions. Perf fixture `?fixture=painter&captions=4` (test loader).

## Touch-set & Test Plan

| File                                     |
| ---------------------------------------- |
| `src/editor/liveCaption.ts`              |
| `src/editor/TextSection.tsx`             |
| `src/editor/TextSection.css`             |
| `src/editor/InspectorControls.tsx`       |
| `src/editor/InspectorControls.css`       |
| `src/editor/bookStore.ts`                |
| `src/editor/textEditStore.ts`            |
| `src/editor/TextEditOverlay.tsx`         |
| `src/render/SpreadView.tsx`              |
| `src/ui/icons/glyphs.ts`                 |
| `src/testFixtures/loadPainterFixture.ts` |
| `e2e/fixtures/write-exif-meta-jpegs.mjs` |
| `e2e/fixtures/ensurePhotoFixtures.ts`    |

- Unit/PBT: `liveCaption.test.ts`, `TextSection.test.tsx`, edit store, memo.
- e2e `e2e/live-captions.spec.ts`: real EXIF JPEG import; empty / happy / interact, inspector y positions, no page scroll; perf gate.
