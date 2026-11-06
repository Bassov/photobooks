## Decisions

1. Lazy `SitePreview` reuses `SiteBookPage` (`embedded`, no All books / Share) with a `renderSlide` that paints the live store book with the editor's renderers. The Suspense fallback is the eager `SitePreviewBar`. Bar values follow the Designer spec §2, with tokens `--bar` and `--border`.
2. Keys: pure `sitePreviewKey` behind one `document` capture listener. The editor's own `window` capture listeners run earlier, so they check a new `editorKeysSuspended()` gate.
3. The editor stays mounted; `EditorFrame` gets `inert` and the preview renders outside it. Close focuses `present`.

## Touch-set & Test Plan

| File                                                           | Why            |
| -------------------------------------------------------------- | -------------- |
| `src/editor/SitePreview.tsx`                                   | lazy preview   |
| `src/editor/SitePreviewBar.tsx`                                | bar / fallback |
| `src/editor/sitePreviewKeys.ts`                                | key map        |
| `src/editor/sitePreviewKeys.test.ts`                           | unit + PBT     |
| `src/editor/SitePreview.test.tsx`                              | unit           |
| `src/editor/SitePreviewBar.test.tsx`                           | unit           |
| `src/editor/editorKeysGate.ts`                                 | gate           |
| `src/editor/editorKeysGate.test.ts`                            | unit           |
| `src/site/siteViewer.css`                                      | h1 gap         |
| `docs/design.md`                                               | preview tokens |
| `src/editor/EditorShell.tsx`                                   | mount, inert   |
| `src/editor/EditorFrame.tsx`                                   | `inert`        |
| `src/editor/EditorTopBar.tsx`                                  | title          |
| `src/editor/isTypingTarget.ts`                                 | gate           |
| `src/editor/usePasteboardCamera.ts`                            | gate           |
| `src/editor/cropGesture.ts`                                    | gate           |
| `src/editor/frameHandleGesture.ts`                             | gate           |
| `src/editor/FitCropSection.tsx`                                | gate           |
| `src/editor/PresentationMode.tsx`                              | delete         |
| `src/editor/PresentationMode.test.tsx`                         | delete         |
| `src/editor/EditorShell.test.tsx`                              | update         |
| `src/editor/lowDpiBadge.test.tsx`                              | update         |
| `e2e/site-preview-mode.spec.ts`                                | new            |
| `e2e/presentation-mode.spec.ts`                                | delete         |
| `e2e/preview-no-overlays.spec.ts`                              | update         |
| `e2e/design-r7-panels.spec.ts`                                 | update         |
| `e2e/text-frames-core.spec.ts`                                 | update         |
| `e2e/text-frames.spec.ts`                                      | update         |
| `e2e/guides.spec.ts`                                           | update         |
| `e2e/dpi-badge.spec.ts`                                        | update         |
| `e2e/topbar-kit-parity.spec.ts`                                | update         |
| `openspec/changes/site-preview-mode/specs/spread-view/spec.md` | delta          |

Tests: the spec's Tests list, including the Browser check (edit the cover title, preview again, it updates). Perf: CPU ×4, zero LoAF, chunk not in the initial JS. Must still pass unchanged: design-r11-topbar, design-tokens, EditorTopBar.test, SpreadPager.test, site-viewer.
