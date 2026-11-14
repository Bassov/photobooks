# design-r26-icon-classes

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item design-r26-icon-classes
Status: done

## Scope

Designer parity site-settings 2026-11-14 (Must M113): prod icons ignore colour and size utility classes, because the unlayered `src/ui/Icon.css` base rules (`.pb-icon { color: currentColor }`, `.pb-icon[data-size]` width/height) beat Tailwind utilities. Settings nav icons (Library, Hosting, Site, Print presets) paint rgb(57,55,56) instead of the kit's muted rgb(83,81,82); the Hosting "Cloudflare R2 tokens" link icon is 14×14 instead of 12×12. Lane: `src/editor/SettingsScreen.tsx`, `src/editor/HostingSection.tsx`, `src/ui/Icon*` + icon size token, and their tests/e2e.

- [x] Settings nav icons take the muted colour from a parent with `currentColor` (no global `Icon.css` colour change)
- [x] Icon size 12 (`--icon-size-12`) exists; the R2 tokens link icon passes `size={12}`
- [x] e2e paint check: the 4 Settings nav icons' clipped pixels are rgb(83,81,82) ±2; the R2 tokens link icon box is 12×12
- **Done when:** the cases above pass; existing unit/e2e stay green; no other icon's computed colour or size changes (every `<Icon` with a colour/size class listed in the PR as already correct, fixed or left out).
- **Browser check:** Settings → each nav row: icon reads muted grey like the kit; Settings → Hosting: the R2 tokens link icon is 12 px.
- **Hard nos:** no global `Icon.css` layer/colour change; nothing in `uikit/**`; no other items' roadmap lines.
