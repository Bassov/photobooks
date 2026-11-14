## Implementation

- [ ] 1. Settings nav icon inherits `text-muted-foreground` from a wrapper span (`SettingsScreen.tsx`)
- [ ] 2. Icon size 12: `ICON_SIZES`, `--icon-size-12`, `Icon.css` rule, `docs/design.md`
- [ ] 3. Hosting R2 tokens link icon `size={12}` (`HostingSection.tsx`)
- [ ] 4. e2e `design-r26-icon-classes.spec.ts`: nav icon pixels muted, R2 link icon 12×12

## Manual test scenarios

1. Open Settings: each of the 4 nav icons is muted grey, labels stay dark.
2. Settings → Hosting: the "Cloudflare R2 tokens" link icon is 12 px.
