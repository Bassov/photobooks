## Decisions

1. **Port kit JSX into `src/editor/`** — copy Welcome / Mark / LibStyle (welcome-only CSS) / PhotoCaption(+c18 credit); never import `uikit/src/**`. Hero `c18.jpg` → `public/photos/hi/`.
2. **Keep session wiring** — Create Library → `chooseLibraryFolder`; regrant / restorePending / homeError stay on the same surface (kit has no regrant UI; quiet overlay/CTA).
3. **Testids** — root stays `welcome-screen` (e2e); primary kit label **Create Library** with `create-library`; credit `screen-credit`.
4. **Mark icon** — add in-repo `bookOpen` glyph (no `lucide-react`). Primary CTA uses app `Button` + Tailwind size/shadow (`h-12 rounded-full shadow-ink`); `--primary` black.
5. **Retire welcome placeholder CSS** — drop `.pb-screen--welcome` from `screenPlaceholdersStyles`; update `docs/design.md` Welcome gap + editor-shell Welcome copy to Create Library.

## Touch-set & Test Plan

- Files: `src/editor/WelcomeScreen.tsx` (+css or inline LibStyle), `src/editor/welcomeCredits.ts` / PhotoCaption, `src/ui/icons/glyphs.ts`, `public/photos/hi/c18.jpg`, `screenPlaceholdersStyles.ts`, unit/e2e welcome specs, `docs/design.md`, `openspec/specs/editor-shell` delta
- Reuse: `Button`, `cn`, Theme B tokens, `projectSession.chooseLibraryFolder` / `regrantLibrary`
- Tests: unit Welcome (create / regrant / loading / error / credit); e2e welcome empty + no page scroll + unsupported unchanged; `assert:no-uikit-in-app`
- Gates: no coverage / Stryker / e2e threshold changes; skill `ui-review` before push
