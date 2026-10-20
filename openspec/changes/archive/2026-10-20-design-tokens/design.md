## Decisions

1. Token SoT = `docs/design.md` Theme B names (`--background`, `--chrome`, `--canvas`, `--paper`, `--foreground`, `--muted-foreground`, `--primary` / `--primary-foreground`, `--accent` / `--accent-foreground`, `--ring`, `--select`, `--destructive`, `--success`, `--warning`, `--border`, type/radius/spacing/shadow/motion). Roadmap “surface/ink/pasteboard” map to these (chrome/canvas/foreground); no parallel alias set.
2. `src/ui/tokens.css` holds primitives + semantic roles for `html[data-theme="b"|"b-dark"]`; `prefers-reduced-motion` zeroes `--motion-*`. Default theme from `prefers-color-scheme` via mount bootstrap (no persistence UI).
3. Self-hosted Inter/Lora woff2 copied under `src/ui/fonts/` (latin + latin-ext + cyrillic, `font-display: swap`); preload latin faces in `index.html`; remove Google Fonts. App must not import `uikit/` (bundle assert).
4. Migrate editor chrome CSS listed in roadmap + `HomeScreen.css` (token swap only). Book page fills stay document-driven (`--paper` light in dark theme; `.spread-view` uses `--paper`).
5. `scripts/check-css-tokens.mjs` in `quality/gates.json` `checks.core`: ban raw color / font-size / border-radius outside `src/ui/tokens.css` and `src/ui/fonts/fonts.css`.
6. Dev/test `?specimen` via `mountPhotobooks` / `createRootTree` (avoid bang-excluded `App.tsx`). Changing `main.tsx` removes its Stryker bang-exclude.
7. Drop Google Fonts: update `vite.config.ts` COEP comment; keep credentialless for workers/OPFS isolation.

## Touch-set & Test Plan

- Files: `src/ui/tokens.css`; `src/ui/fonts/*`; specimen + mount helpers; chrome CSS; `index.html`; `src/main.tsx`; `scripts/check-css-tokens.mjs`; `quality/gates.json`; `package.json`; `vite.config.ts`; `docs/design.md`; roadmap item.
- Reuse: kit Theme B / fonts copy; painter `?fixture=` pattern.
- Tests: unit for check script; e2e specimen + scrollports + b-dark paper; skill `ui-review` before archive.
