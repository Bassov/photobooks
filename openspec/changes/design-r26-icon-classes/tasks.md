## Implementation

- [x] 1. Settings nav icon inherits `text-muted-foreground` from a wrapper span (`SettingsScreen.tsx`) — e2e `M113: Settings nav icons paint the muted ink`
- [x] 2. Icon size 12: `ICON_SIZES`, `--icon-size-12`, `Icon.css` rule, `docs/design.md` — `Icon.test.tsx` `applies size token 12`
- [x] 3. Hosting R2 tokens link icon `size={12}` (`HostingSection.tsx`) — e2e `M113: Hosting R2 tokens link icon is 12×12`
- [x] 4. e2e `design-r26-icon-classes.spec.ts`: nav icon pixels muted, R2 link icon 12×12 (fails on `origin/main`: rgb(57, 55, 56), 14)

## Manual test scenarios

1. Open Settings: each of the 4 nav icons is muted grey, labels stay dark.
2. Settings → Hosting: the "Cloudflare R2 tokens" link icon is 12 px.

manual-qa: problem (harness) — both scenarios blocked at the welcome screen (`start-session` click intercepted by the header); evidence is e2e `design-r26-icon-classes.spec.ts` (green; red on `origin/main`: rgb(57, 55, 56), 14 px).
