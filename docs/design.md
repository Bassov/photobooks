# Photobooks design language

Source of truth for product UI. Live specimens: UI kit at `/uikit/` (`UI ref: uikit#/feature/<slug>`). When this doc and the current `src/` chrome disagree, **the kit wins**; gaps are listed in [Migration audit](#migration-audit).

Agents: use tokens and primitives named here. New tokens or primitives are added to this file in the same change. Cursor rule: `.cursor/rules/design.mdc`. Skill gate: `ui-review`.

## Principles

1. **Photo is the visual anchor** — chrome stays quiet; metadata is secondary to the image.
2. **Neutral chrome** — warm-neutral Theme B; no purple brand fills, no tinted pasteboard that competes with photos.
3. **Density** — editor controls prefer compact (`sm` / h-8) over marketing spacing.
4. **One primary action per view** — e.g. Export, Open library, Grant access; everything else is quiet (ghost / outline / icon).

UI ref: `uikit#/feature/design-tokens`, `uikit#/feature/editor-chrome-toolbar`.

## Visual direction

Theme **B** (light) and **B-dark** from `uikit/src/index.css`. Fonts: Inter Variable (UI), Lora Variable (headings), self-hosted woff2 (Latin + Cyrillic). Theme A (Untitled purple) is kit-only legacy — do not ship in the product.

UI ref: `uikit#/feature/design-tokens`, `uikit#/feature/dark-theme`.

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

Do not put raw brand colour on large surfaces. Book page fills come from the document, not chrome tokens (`--paper` stays light in dark theme).

UI ref: `uikit#/feature/design-tokens`, `uikit#/feature/dark-theme`.

## Iconography

One family: **lucide-react**, stroke 2, `currentColor`. Size tokens: **14 / 16 / 20**. Icon-only controls always have an accessible name + tooltip. Decorative icons are `aria-hidden`.

UI ref: `uikit#/feature/icon-set`.

## Copy tone

Short, plain, local-first. Prefer verbs users do (“Grant access”, “Open library”). Errors name the next step. No marketing fluff in editor chrome. Status strings stay scannable (save: Saved / Saving… / Error).

## Dark-mode policy

`html[data-theme="b" | "b-dark"]`. Default from `prefers-color-scheme`; user choice persisted (kit: `localStorage`). Pasteboard/canvas darkens; **book paper stays light**. Screenshot / axe coverage runs in both themes when UI ships.

UI ref: `uikit#/feature/dark-theme`.

## Editor chrome vs book content

| Layer        | Owns                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- |
| Chrome       | Top bar, dock, filmstrip, inspector, dialogs, toasts — Theme B tokens + primitives       |
| Book content | Page paper, photo pixels, captions as document data — not restyled by chrome theme fills |

Selection / focus rings use `--ring` / `--select`; never confuse focus ring with selection fill.

UI ref: `uikit#/feature/editor-chrome-toolbar`, `uikit#/feature/editor-chrome-states`.

## Component inventory

Canonical specimens: kit **Components** page (`/uikit/#/components`) and M2.5 feature pages. Kit column = SPECS id → DOM `id="c-<id>"` (scroll target, not a hash-route). Required interactive states unless N/A: **default · hover · focus-visible · pressed · selected · disabled · loading · error**.

| Primitive                                        | Kit (SPECS → DOM)                    | Variants                                                                                                                                           | Required states                                                   |
| ------------------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Button                                           | `button` → `#c-button`               | default, outline, secondary, ghost, link, destructive-outline, destructive-ghost, destructive (AlertDialog confirm only); sizes sm/default/lg/icon | default, hover, focus-visible, pressed, disabled, loading         |
| IconButton + Tooltip                             | `icon-button` → `#c-icon-button`     | sm 28 / md 32                                                                                                                                      | default, hover, focus-visible, disabled                           |
| Toggle / ToggleButtonGroup / Segmented           | `toggle` → `#c-toggle`               | tool group, outline, Segmented sm/md                                                                                                               | off/on, hover, focus-visible, disabled                            |
| Toolbar                                          | `toolbar` → `#c-toolbar`             | —                                                                                                                                                  | roving focus; disabled children                                   |
| Tabs                                             | `tabs` → `#c-tabs`                   | TabList sm/md/lg; TabCount                                                                                                                         | selected, focus-visible, disabled                                 |
| Menu                                             | `menu` → `#c-menu`                   | sections, keyboard, destructive item                                                                                                               | default, disabled, destructive                                    |
| Select / ListBox                                 | `select` → `#c-select`               | compact SelectRow                                                                                                                                  | default, disabled, invalid                                        |
| TextField / NumberField / SearchField / NumField | `textfield` → `#c-textfield`         | —                                                                                                                                                  | default, focus, disabled, invalid                                 |
| Checkbox / Switch                                | `checkbox` → `#c-checkbox`           | Switch sm                                                                                                                                          | unchecked/checked/indeterminate, focus-visible, disabled, invalid |
| Slider / SliderRow                               | `slider` → `#c-slider`               | single, range                                                                                                                                      | default, disabled                                                 |
| Progress                                         | `progress` → `#c-progress`           | determinate, indeterminate                                                                                                                         | loading                                                           |
| Disclosure / Section                             | `disclosure` → `#c-disclosure`       | collapsed summary                                                                                                                                  | expanded/collapsed, focus-visible                                 |
| GridList / ThumbGrid / PhotoThumb                | `grid-list` → `#c-grid-list`         | grid selection                                                                                                                                     | default, selected, disabled                                       |
| Popover / Dialog / AlertDialog / AppModal        | `overlays` → `#c-overlays`           | —                                                                                                                                                  | open/closed; confirm destructive                                  |
| Toast                                            | `toast` → `#c-toast`                 | default, success, error (+ action)                                                                                                                 | —                                                                 |
| Badge                                            | `badge` → `#c-badge`                 | color × size × type; status dot                                                                                                                    | —                                                                 |
| FeaturedIcon                                     | `featured-icon` → `#c-featured-icon` | light/outline; sm–xl; success/warning/error                                                                                                        | —                                                                 |
| Kbd / Separator / Label                          | `kbd` → `#c-kbd`                     | —                                                                                                                                                  | —                                                                 |

Feature compositions (not raw primitives): editor chrome toolbar / camera bar — `uikit#/feature/editor-chrome-toolbar`; chrome empty/loading/error — `uikit#/feature/editor-chrome-states`; project screens — `uikit#/feature/project-screens-adoption`.

### Empty / loading / error patterns

| Pattern           | Use                                                                          | Kit                                                               |
| ----------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| EmptyState        | Home with no libraries; empty inspector; empty filmstrip hint                | `uikit#/feature/project-screens-adoption`, `editor-chrome-states` |
| Loading           | Import progress, save pending, button `isPending`                            | Components `progress` / `button` (`#c-progress`, `#c-button`)     |
| Error             | Toast with action; field `errorMessage`; AlertDialog for destructive confirm | `toast` / `textfield` / `overlays` (`#c-toast`, …)                |
| Missing assets    | Relink dialog / panel built from Dialog + Badge + FeaturedIcon               | `uikit#/feature/project-screens-adoption`                         |
| Permission / lock | Quiet banner + primary Grant access; lock disables Save                      | `uikit#/feature/project-screens-adoption`                         |
| Save indicator    | Saved / Saving… / pending / error via status tokens (not ad-hoc red hex)     | `uikit#/feature/project-screens-adoption`                         |

## Migration audit

Checklist for M2.5 token adoption. **Kit wins** on every gap.

| Area                | Current (`src/`)                                                                                                             | Kit target                                                              | Gap                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| Global tokens       | `src/index.css`: green `--ink` / `--paper` / `--accent`, Fraunces + Source Sans, radial washes                               | Theme B neutrals, Inter + Lora, `--chrome`/`--canvas`/`--paper`         | Replace palette + fonts; drop green marketing wash |
| Buttons             | Duplicated `.editor-action` / `.editor-action-secondary` / `.spread-template-add` / `.camera-control` / `.filmstrip-unplace` | Button / IconButton primitives                                          | One button system; remove per-surface copies       |
| Hardcoded colour    | `#f7fbf8`, `#8b2e2e`, `#8a1f1f`, `#fbfcfb`, `color-mix(…, #fff)` in EditorShell / HomeScreen / SpreadView / Filmstrip CSS    | Semantic roles (`--destructive`, `--background`, `--paper`, …)          | No raw hex in chrome CSS                           |
| Radius              | `0.35rem`, `4px` ad hoc                                                                                                      | `--radius-*`                                                            | Unify                                              |
| Focus               | `outline: 2px solid var(--accent)`                                                                                           | `--ring` focus-visible rings                                            | Align with kit ring                                |
| Home                | `HomeScreen.css` green chrome + brand Fraunces                                                                               | Tokens + EmptyState / Button; `uikit#/feature/project-screens-adoption` | Full restyle                                       |
| Permission / lock   | Banner text + Grant access secondary/primary mix                                                                             | Quiet banner + one primary                                              | Match kit screen                                   |
| Save indicator      | Phase colours via `#8b2e2e`                                                                                                  | Status tokens / Badge                                                   | Tokenize                                           |
| Missing assets      | (product flow exists; styling pre-kit)                                                                                       | Relink Dialog pattern                                                   | Adopt kit dialog/badge                             |
| Filmstrip           | Custom card chrome, greenish paper mix                                                                                       | ThumbGrid / PhotoThumb rules                                            | Align thumb geometry + tokens                      |
| Spread / pasteboard | `#fbfcfb` view chrome; accent outlines                                                                                       | `--canvas` / `--select` / `--ring`; paper from document                 | Separate chrome vs page                            |
| Dark theme          | Not in product                                                                                                               | `data-theme` B / B-dark                                                 | Ship with token migration                          |
| Icons               | Sparse / emoji-free but not lucide map                                                                                       | lucide 14/16/20 map                                                     | Adopt icon-set                                     |

UI ref for target screens: `uikit#/feature/design-tokens`, `icon-set`, `editor-chrome-toolbar`, `editor-chrome-states`, `project-screens-adoption`, `dark-theme`.
