# ui-tw-bridge-v093

Tag: prep
Milestone: M2.6
Title: Tailwind 4 + uikit v0.9.3 token bridge

## Scope

- [ ] Add `tailwindcss` + `@tailwindcss/vite` to the app (match `uikit/package.json` versions); wire the Vite plugin
- [ ] Port kit `@theme` / Theme B token subset from `uikit/src/index.css` into app CSS (`src/ui/tokens.css` + entry); kit v0.9.3 values win (grayscale chrome, `--color-sel: #CACACA`, gray `--crop`, no blue brand fills)
- [ ] Add thin `cn` helpers matching kit (`clsx` + `tailwind-merge` + `class-variance-authority` as needed); keep fonts Inter/Lora; scope or omit Tailwind preflight so existing screens stay CI-green
- [ ] Tiny proof: specimen or unit test using `bg-chrome` / `bg-sel` / `text-muted-foreground` (or kit equivalents) that builds
- [ ] Keep `assert:no-uikit-in-app`, `check:css-tokens` (update intentionally if token names/hex change), `pnpm check:fast`, unit, e2e green — no gate weakening
- **Done when:** App can render ported kit JSX (Tailwind utilities + kit Theme B tokens) without importing `uikit/src`; PR checks green
- **UI kit:** `uikit/src/index.css` (`@theme` + Procreate-light tokens), `UI ref: uikit#/demo` — token/surface language the bridge must match
- **Browser check:** Specimen (or equivalent) shows kit utility classes resolving; empty home + painter editor still load without page scroll / layout break from preflight
- **Perf:** N/A (CSS/toolchain foundation; no interaction path change)
- **Size:** ~400–800 changed lines (deps + tokens + thin helpers + proof); target ~1000
- **Source:** Owner package B (kit v0.9.3 screen-port foundation)
