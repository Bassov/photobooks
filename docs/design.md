# Photobooks design language

Source of truth for product UI. Live specimens: UI kit **v0.9.3** at `/uikit/` — screens (`UI ref: uikit#/screen/<id>`), full demos (`uikit#/full/<id>`), end-to-end (`uikit#/demo`), and feature pages (`uikit#/feature/<slug>`). When this doc and the current `src/` chrome disagree, **the kit wins**; gaps are listed in [Migration audit](#migration-audit).

Agents: use tokens and primitives named here. New tokens or primitives are added to this file in the same change. Cursor rule: `.cursor/rules/design.mdc`. Skill gate: `ui-review`.

## Principles

1. **Photo is the visual anchor** — chrome stays quiet; metadata is secondary to the image.
2. **Neutral chrome** — warm-neutral Theme B; no purple brand fills, no tinted pasteboard that competes with photos.
3. **Density** — editor controls prefer compact (`sm` / h-8) over marketing spacing.
4. **One primary action per view** — e.g. Export, Open library, Grant access; everything else is quiet (ghost / outline / icon).

UI ref: `uikit#/demo`, `uikit#/full/editor`, `uikit#/feature/design-tokens`.

## Visual direction

Single product theme: **B** (light) from `uikit/src/index.css` / `src/ui/tokens.css`. Fonts: Inter Variable (UI), Lora Variable (headings), self-hosted woff2 (Latin + Cyrillic). No dark theme and no theme switching in the product or kit.

UI ref: `uikit#/feature/design-tokens`.

## Scales

Values resolve from kit CSS variables (Theme B). Prefer tokens over raw hex in app chrome.

| Scale     | Tokens / notes                                                                                                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type      | `--text-xs` 12px · `--text-sm` 13.5px (default UI) · `--text-base` 15px · `--text-lg` 18px · `--text-xl` 21px · `--text-2xl` 26px · `--text-3xl` 32px; `.heading` → Lora; `.eyebrow` 11px uppercase |
| Spacing   | `--spacing` 0.25rem (4 px base); compact density `--spacing` 0.2rem                                                                                                                                 |
| Radius    | `--radius` 10px; `sm`/`md`/`lg`/`xl`/`2xl` from `--radius-*`                                                                                                                                        |
| Elevation | `--shadow-xs` … `--shadow-lg`; page stack `--page-shadow`                                                                                                                                           |
| Z-layer   | overlays (popover/dialog/toast) above chrome; pasteboard content below chrome; no ad-hoc z-index races — stack: content → chrome → floating camera bar → modal → toast                              |
| Motion    | short press scale (~0.98), disclosure chevron 200 ms; honor `prefers-reduced-motion` (non-essential motion off)                                                                                     |

Chrome geometry: `--panel-left` / `--panel-right` / `--topbar` / `--thumb` / `--rail` (kit demo may tighten these).

UI ref: `uikit#/feature/design-tokens`.

## Semantic color roles

Surfaces: `--background`, `--chrome`, `--canvas`, `--paper`, `--card`, `--popover`.  
Text: `--foreground`, `--muted-foreground`, `--primary` / `--primary-foreground`.  
Fills: `--secondary`, `--muted`, `--subtle`, `--accent` / `--accent-foreground`.  
Lines: `--border`, `--input`, `--ring`.  
Editor: `--select` (selection / drop), `--guide`, `--grid` / `--grid-line`.  
Status: `--success`, `--warning`, `--destructive` (text/icon); `--destructive-solid` (+ hover) only for AlertDialog confirm.  
Badges: `--badge-{gray,brand,success,warning,error}-{fg,bg,ring,dot}`.

Do not put raw brand colour on large surfaces. Book page fills come from the document, not chrome tokens.

UI ref: `uikit#/feature/design-tokens`.

## Iconography

One family: **in-repo SVG set** (`src/ui/Icon.tsx` + `src/ui/icons/`), Lucide-compatible stroke 2, `currentColor`, 24×24 viewBox. Size tokens: **14 / 16 / 20** (`--icon-size-14/16/20`). No `lucide-react` in the app package (kit may keep lucide as visual reference). Icon-only controls always have an accessible name + tooltip. Decorative icons omit `label` and are `aria-hidden`.

UI ref: `uikit#/feature/icon-set`.

## Copy tone

Short, plain, local-first. Prefer verbs users do (“Grant access”, “Open library”). Errors name the next step. No marketing fluff in editor chrome. Status strings stay scannable (save: Saved / Saving… / Error).

## Theme policy

One theme only (Theme B light on `:root`). No `data-theme` switching, no `prefers-color-scheme` flip, no persisted theme preference. Screenshot / axe coverage runs on this single theme.

## Editor chrome vs book content

| Layer        | Owns                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| Chrome       | Top bar, dock, filmstrip, inspector, dialogs, toasts — Theme B tokens + primitives |
| Book content | Page paper, photo pixels, captions as document data — not restyled by chrome fills |

Selection / focus rings use `--ring` / `--select`; never confuse focus ring with selection fill.

UI ref: `uikit#/full/editor`, `uikit#/screen/editor`, `uikit#/feature/editor-chrome-toolbar`.

## Component inventory

Canonical specimens: kit **Components** page (`/uikit/#/components`), screen demos (`uikit#/screen/<id>`), and feature pages. Kit column = SPECS id → DOM `id="c-<id>"` (scroll target, not a hash-route). Required interactive states unless N/A: **default · hover · focus-visible · pressed · selected · disabled · loading · error**.

| Primitive                                        | Kit (SPECS → DOM)                    | Variants                                                                                                                                                                                                                | Required states                                                   |
| ------------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Button                                           | `button` → `#c-button`               | kit: default, outline, secondary, ghost, link, destructive-*; **app `src/ui` ships first:** `default` / `secondary` / `ghost` (roadmap wording primary / secondary / quiet → these props); sizes sm/md (kit default→md) | default, hover, focus-visible, pressed, disabled, loading         |
| IconButton + Tooltip                             | `icon-button` → `#c-icon-button`     | sm 28 / md 32                                                                                                                                                                                                           | default, hover, focus-visible, disabled                           |
| Toggle / ToggleButtonGroup / Segmented           | `toggle` → `#c-toggle`               | tool group, outline, Segmented sm/md                                                                                                                                                                                    | off/on, hover, focus-visible, disabled                            |
| Toolbar                                          | `toolbar` → `#c-toolbar`             | —                                                                                                                                                                                                                       | roving focus; disabled children                                   |
| Tabs                                             | `tabs` → `#c-tabs`                   | TabList sm/md/lg; TabCount                                                                                                                                                                                              | selected, focus-visible, disabled                                 |
| Menu                                             | `menu` → `#c-menu`                   | sections, keyboard, destructive item                                                                                                                                                                                    | default, disabled, destructive                                    |
| Select / ListBox                                 | `select` → `#c-select`               | compact SelectRow                                                                                                                                                                                                       | default, disabled, invalid                                        |
| TextField / NumberField / SearchField / NumField | `textfield` → `#c-textfield`         | —                                                                                                                                                                                                                       | default, focus, disabled, invalid                                 |
| Checkbox / Switch                                | `checkbox` → `#c-checkbox`           | Switch sm                                                                                                                                                                                                               | unchecked/checked/indeterminate, focus-visible, disabled, invalid |
| Slider / SliderRow                               | `slider` → `#c-slider`               | single, range                                                                                                                                                                                                           | default, disabled                                                 |
| Progress                                         | `progress` → `#c-progress`           | determinate, indeterminate                                                                                                                                                                                              | loading                                                           |
| Disclosure / Section                             | `disclosure` → `#c-disclosure`       | collapsed summary                                                                                                                                                                                                       | expanded/collapsed, focus-visible                                 |
| GridList / ThumbGrid / PhotoThumb                | `grid-list` → `#c-grid-list`         | grid selection                                                                                                                                                                                                          | default, selected, disabled                                       |
| Popover / Dialog / AlertDialog / AppModal        | `overlays` → `#c-overlays`           | —                                                                                                                                                                                                                       | open/closed; confirm destructive                                  |
| Toast                                            | `toast` → `#c-toast`                 | default, success, error (+ action)                                                                                                                                                                                      | —                                                                 |
| Badge                                            | `badge` → `#c-badge`                 | color × size × type; status dot                                                                                                                                                                                         | —                                                                 |
| FeaturedIcon                                     | `featured-icon` → `#c-featured-icon` | light/outline; sm–xl; success/warning/error                                                                                                                                                                             | —                                                                 |
| Kbd / Separator / Label                          | `kbd` → `#c-kbd`                     | —                                                                                                                                                                                                                       | —                                                                 |

Feature compositions (not raw primitives): product screens from kit v0.9.3 — Welcome `uikit#/screen/first-run`; library `uikit#/screen/home`; unsupported `uikit#/screen/unsupported-browser`; settings `uikit#/screen/settings`; editor `uikit#/full/editor` / `uikit#/screen/editor`; walkthrough `uikit#/demo`. M2.5 feature pages (`design-tokens`, `editor-chrome-*`, `project-screens-adoption`) remain token/primitive specimens, not the product-screen SoT.

### Empty / loading / error patterns

| Pattern           | Use                                                                                                                        | Kit                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| EmptyState        | Empty library; empty inspector; empty filmstrip hint; pasteboard empty-editor card                                         | `uikit#/screen/home` (empty), `uikit#/full/editor`, Components EmptyState |
| Loading           | Import progress, save pending, button `isPending`                                                                          | Components `progress` / `button` (`#c-progress`, `#c-button`)             |
| Error             | Toast with action; import-errors Dialog panel (grouped dismiss); field `errorMessage`; AlertDialog for destructive confirm | `toast` / `overlays` (`#c-toast`, `#c-overlays`) + Status/`--destructive` |
| Missing assets    | Relink dialog / panel built from Dialog + Badge + FeaturedIcon                                                             | `uikit#/screen/import` / editor chrome + Components overlays              |
| Permission / lock | Quiet banner + primary Grant access; lock disables Save                                                                    | `uikit#/full/editor` chrome states                                        |
| Save indicator    | Saved / Saving… / pending / error via status tokens (not ad-hoc red hex)                                                   | `uikit#/full/editor` / `uikit#/screen/editor-chrome`                      |
| Unsupported       | No FSA → kit unsupported screen (no continue-anyway)                                                                       | `uikit#/screen/unsupported-browser`                                       |

## Migration audit

Product screens are **rebuilding from UI kit v0.9.3** (M2.6). Old `pb-screen` placeholders are retired per packages D+ (`ui-welcome-v93` …) — they are **not** “placeholder done”. M2.5 token/primitive adoption still stands for chrome CSS; screen chrome follows kit screen/full/demo routes. **Kit wins** on every gap. Site/print kit demos are **not now**.

| Area                | Current (`src/`)                                       | Kit target (v0.9.3)                                         | Gap                                                        |
| ------------------- | ------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------- |
| Global tokens       | `src/ui/tokens.css` Theme B; Inter + Lora; `?specimen` | Kit `@theme` / Procreate-light (`ui-tw-bridge-v093`)        | Bridge in flight — kit values win where they differ        |
| Tailwind utilities  | Hand CSS; no app Tailwind                              | Tailwind 4 + kit utilities (`ui-tw-bridge-v093`)            | Foundation for ported JSX                                  |
| Welcome / first-run | Interim / placeholder chrome                           | `uikit#/screen/first-run`, `uikit#/demo`                    | Rebuild (`ui-welcome-v93`); retire `pb-screen` Welcome     |
| Unsupported browser | Interim gate if any                                    | `uikit#/screen/unsupported-browser`                         | Rebuild (`ui-unsupported-v93`)                             |
| Empty library       | Prior EmptyState / create flow                         | `uikit#/screen/home` (empty) + Create book dialog           | Rebuild (`ui-library-empty-v93`); not “placeholder done”   |
| Library grid        | Recents/home book list                                 | `uikit#/screen/home` book objects + search/sort             | Rebuild (`ui-library-grid-v93`)                            |
| Settings            | Minimal / missing                                      | `uikit#/screen/settings` stub                               | Port stub (`ui-settings-stub-v93`)                         |
| Editor shell        | Pre-kit chrome + working place/crop/import             | `uikit#/full/editor`, `uikit#/screen/editor`, `uikit#/demo` | Rebuild chrome (`ui-editor-shell-v93`); keep working logic |
| Editor hard-nos     | Partial                                                | v0.9.x hard-nos in `uikit/README.md`                        | Parity pass (`ui-editor-parity-v93`)                       |
| Buttons / overlays  | `src/ui` primitives; some duplicated chrome CSS        | Kit Button / Toolbar / overlays                             | Come along with screen ports                               |
| Filmstrip           | Token chrome; geometry custom; place/crop logic works  | Kit filmstrip dock + tone-only selection                    | Align in editor shell / parity                             |
| Theme               | Single Theme B light; no toggle                        | Single Procreate-light                                      | Done (single-theme); bridge locks kit hex                  |
| Icons               | In-repo `Icon` + glyphs                                | In-repo SVG (kit lucide is reference only)                  | Done — do not add `lucide-react` to the app                |
| Site / print UI     | Not started                                            | `uikit#/screen/showcase-site`, `print-prep`, `print-export` | **Not now** (parked)                                       |

UI ref for target screens: `uikit#/demo`, `uikit#/full/editor`, `uikit#/screen/first-run`, `home`, `settings`, `unsupported-browser`, `editor`.
