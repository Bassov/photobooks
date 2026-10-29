# look-parity-scrollbars

Tag: lite
Milestone: M4
Title: look parity: thin custom scrollbars (kit v5)
Status: done

## Scope

Owner 2026-10-29: the editor must look exactly like the UI kit; system scrollbars are ugly, the kit has thin custom ones.

- [x] Kit v5 `::-webkit-scrollbar` rules ported globally into `styles/app.css` (`*` selectors, `@layer components`), plus `.no-scrollbar`.
- [x] Drop the `.e7` hex thumb colours and `.editor-inspector` `scrollbar-width: thin; scrollbar-color` from `src/editor/editorChromeTokens.ts`.
- [x] Computed-style e2e on the inspector.

## Done when

- Every app scroll area shows the kit scrollbar: 10px gutter, 4px thumb at rest, 6px on area hover, 8px on thumb hover, radius 99px, min 32px, transparent track/corner, no buttons.
- `.editor-inspector` has no `scrollbar-width` override.
- `pnpm check:css-tokens` green; e2e `scrollbars.spec.ts` green.

## Browser check

Left list, assets panel and inspector scrollbars match the kit (screenshots in the PR).

## Perf

None: static CSS, no layout change.

## Kit components

Native overflow areas (kit has no ScrollArea component).

## Demo

`uikit/src/sandbox/v7.tsx`; CSS `uikit/src/index.css` ("v5: applied to every scroll area").

## Musts

- Kit scrollbar replicated exactly, applied globally with `*` selectors.
- No global `scrollbar-color` / `scrollbar-width` (they override WebKit styling in Chrome); Firefox keeps native, as in the kit.
- `.no-scrollbar` ported; hidden-scrollbar places stay hidden.

## Hard nos

No colours outside tokens; no JS scroll library; no layout or behaviour change; `src/editor/Inspector.tsx` untouched.

## Tokens

`--scroll-thumb-rest`, `--scroll-thumb`, `--scroll-thumb-hover` (`styles/tokens.css`).

## Test

`pnpm check:css-tokens`; `e2e/scrollbars.spec.ts`.

## Depends

None.
