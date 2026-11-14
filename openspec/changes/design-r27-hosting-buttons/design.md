## Decisions

1. M114: the `@container` wrapper (its full width drives the subdomain `@max-[704px]` query) takes the card's `mt-5` and the card gets `mt-0`, so the top margin collapses with the intro margin again.
2. M115: `src/ui/Button.css` is unlayered and another lane, so Change and CORS Copy keep `variant="ghost" size="sm"` and override with important utilities (`h-7! px-2! text-xs! text-foreground!`), the `!` idiom the Change hover already uses. Values use the `--spacing`, `--text-xs` and `--foreground` tokens; no new Button size.
3. M117: `LoaderGlyph` (export lane) only draws 16 | 20, so `hostingBits.tsx` gets a local 14 px `Spinner` drawn like `Icon` (`pb-icon`, `data-size="14"`). The nav head passes `size={12}`, no size class.
4. Row 6 warn icon: the `text-warning` colour moves to a wrapping span the icon inherits (M113 rule).

## Touch-set & Test Plan

| Path                              |
| --------------------------------- |
| `src/editor/HostingSetup.tsx`     |
| `src/editor/HostingSection.tsx`   |
| `src/editor/hostingBits.tsx`      |
| `src/editor/hostingBits.test.tsx` |
| `src/editor/SettingsScreen.tsx`   |
| `e2e/fixtures/cloudflareRelay.ts` |
| `e2e/hosting-setup.spec.ts`       |
| `e2e/design-r27-hosting.spec.ts`  |

- Reuse / tests: the Cloudflare stub moves to `e2e/fixtures/cloudflareRelay.ts`; the new spec checks the Done-when numbers at 1440×900 with `pixelsAt` paint checks; empty and scroll states are unchanged; skill `ui-review` before push.
