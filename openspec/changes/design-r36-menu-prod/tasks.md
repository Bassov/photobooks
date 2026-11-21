## Implementation

- [x] 1. Drop `color: currentColor` from `.pb-icon`; destructive menu row icon rule in `Menu.css`; dead `text-muted-foreground` off the Library search / sort icons (M138). Evidence: `e2e/frame-context-menu.spec.ts` FM3 filled-frame test (ink + paint).
- [x] 2. `copyPlus` glyph (lucide 1.70) and frame-menu Duplicate row uses it (M139). Evidence: `src/editor/frameMenuModel.test.ts`, `src/ui/Icon.test.tsx`.
- [x] 3. `bringToFront` glyph = lucide 1.70 BringToFront (M140). Evidence: `src/ui/Icon.test.tsx`.
- [x] 4. Unit tests (frameMenuModel icons, glyph nodes) and e2e icon ink + glyph checks in `e2e/frame-context-menu.spec.ts`.

## Manual test scenarios

1. Open the editor, right-click a photo frame: row icons are grey (muted), the Delete frame icon is dark; Duplicate shows a copy-with-plus glyph, Bring to front the lucide drawing; ARRANGE Bring to front button shows the same glyph.
2. Spread list row menu: Duplicate keeps its old glyph; icons muted, Delete dark.
