# Photobooks design language

Source of truth for product UI. Live specimens: UI kit **v0.9.3** at `/uikit/` — screens (`UI ref: uikit#/screen/<id>`), full demos (`uikit#/full/<id>`), end-to-end (`uikit#/demo`), and feature pages (`uikit#/feature/<slug>`). When this doc and the current `src/` chrome disagree, **the kit wins**; gaps are listed in [Migration audit](#migration-audit).

Agents: use tokens and primitives named here. New tokens or primitives are added to this file in the same change. Rule: `.cursor/rules/design.mdc` (Claude: `.claude/rules/design.md`). Skill gate: `ui-review`.

## Principles

1. **Photo is the visual anchor** — chrome stays quiet; metadata is secondary to the image.
2. **Neutral chrome** — grayscale Theme B (kit v0.9.3 Procreate-light); no blue/purple brand fills, no tinted pasteboard that competes with photos.
3. **Density** — editor controls prefer compact (`sm` / h-8) over marketing spacing.
4. **One primary action per view** — e.g. Export, Open library, Grant access; everything else is quiet (ghost / outline / icon).

UI ref: `uikit#/demo`, `uikit#/full/editor`, `uikit#/feature/design-tokens`.

## Visual direction

Single product theme: **B** (light) from `uikit/src/index.css` / `styles/tokens.css`. Fonts: Inter Variable (UI), Lora Variable (headings; roman + italic faces), self-hosted woff2 (Latin + Cyrillic). No dark theme and no theme switching in the product or kit.

UI ref: `uikit#/feature/design-tokens`.

## Scales

Values resolve from kit CSS variables (Theme B). Prefer tokens over raw hex in app chrome.

| Scale     | Tokens / notes                                                                                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type      | `--text-xs` 12px · `--text-sm` 13px (default UI) · `--text-base` 14px · `--text-lg` 18px · `--text-xl` 21px · `--text-2xl` 26px · `--text-3xl` 32px; Welcome display `--text-welcome-display` / `--text-welcome-regrant` (kit clamps); `.heading` → Lora; `.eyebrow` 11px uppercase |
| Spacing   | `--spacing` 0.25rem (4 px base); compact density `--spacing` 0.2rem                                                                                                                                                                                                                 |
| Radius    | `--radius` 10px; `sm`/`md`/`lg`/`xl`/`2xl` from `--radius-*`                                                                                                                                                                                                                        |
| Elevation | `--shadow-xs` … `--shadow-lg`; page stack `--page-shadow`                                                                                                                                                                                                                           |
| Z-layer   | overlays (popover/dialog/toast) above chrome; pasteboard content below chrome; no ad-hoc z-index races — stack: content → chrome → modal → toast                                                                                                                                    |
| Motion    | short press scale (~0.98), disclosure chevron 200 ms; honor `prefers-reduced-motion` (non-essential motion off)                                                                                                                                                                     |

Chrome geometry: `--panel-left` / `--panel-right` / `--topbar` / `--thumb` / `--rail` (kit demo may tighten these). The top-bar tool group centres on the canvas area between `--panel-left` and `--panel-right` (not the window).

Menus (`src/ui/Menu`): kit rows `py-1.5 text-sm` at `--leading-menu` 1.45 (30.84 px); a single choice is marked with the 8 px `circle` dot, a multiple choice with the check. Status pill: kit `StatusLine` (bottom-left, `text-xs`, `--radius-md`, popover/95) for the frame-drag hint only; other statuses are live-region only.

Page numbers: 8 screen px under each page, 11 px, at every zoom. Designer-accepted deviation (2026-10-31): page numbers hidden when the gap cannot hold 8 px + 11 px label.

In-canvas chrome (empty / missing hints, crop tag, dpi and lock badges, the 1 px fold) keeps its screen px through a live zoom: `[data-camera-frame]` + `--cam-scale` undo the world scale in the same rAF as the page numbers. No frame size pill (Owner, round 7).

UI ref: `uikit#/feature/design-tokens`.

## Semantic color roles

Surfaces: `--background`, `--chrome`, `--canvas`, `--paper`, `--card`, `--popover`. Presentation overlay (`SpreadPager`): `--presentation` backdrop, `--presentation-ink/-chip/-chip-hover/-chip-ink`, `--shadow-stage-dark`; sits above chrome and toast.  
Text: `--foreground`, `--muted-foreground`, `--primary` / `--primary-foreground`.  
Fills: `--secondary`, `--muted`, `--subtle`, `--accent` / `--accent-foreground`.  
Lines: `--border`, `--input`, `--ring`.  
Editor: `--select` (canvas frame selection / handles — ink/black), tone selection `--sel` / `--color-sel` / `bg-sel` (`#CACACA`), `--crop` (gray; active crop outline 2px + "Crop · N%" tag on `--field`), slider B `--sel` track / `--scroll-thumb-rest` fill / `--slider-fill-drag` / `--slider-thumb` / `--shadow-slider-thumb*` (inspector zoom), `--guide`, `--grid` / `--grid-line` (product: `--grid-fill` rgb(83 81 82/.10), `--grid-line` rgb(83 81 82/.6), grayscale only; snap label `.snap-label` = `--field` pill), frame tool `.frame-draft` (dashed grey outline + 8% wash) and `.snap-line` (1.5px grey line, `.snap-line-label` = `--field` pill `snap · <kind>`). Layout thumbs: `--paper` + `--shadow-hairline`, slots `--placeholder-block`, spine `--thumb-spine`; hover preview scrim `--template-preview-scrim`, dashed `--color-mark` slots.  
Status: `--success`, `--warning`, `--destructive` (text/icon); `--destructive-solid` (+ hover) only for AlertDialog confirm.  
Badges: `--badge-{gray,brand,success,warning,error}-{fg,bg,ring,dot}`.

App Tailwind 4 bridge: `@theme` tokens in `styles/tokens.css` (entry `styles/app.css` from `src/main.tsx`; no `uikit/src` imports); utilities via `@tailwindcss/vite`; preflight omitted until screen ports. Helpers: `src/ui/cn.ts` (`cn` / `cva`).

Library quiet controls (search/sort): kit v0.9.1 tone-only field fill `#D7D7D7` on `--chrome` (no border); focus ring `#3A3839` (same ink as kit `--ring` companion). Hover uses `--accent`.

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

**Pages and spine width.** Book settings Pages is an editable kit `Val` box (no spin arrows) with the "20–120" hint: a typed count rounds to the nearest even number, clamps to 20–120 and adds empty spreads at the end or removes the last ones (one undo step). Pages = 2 × spreads (kit `pagesOf`). Spine width is computed, never stored: **8 mm (hardcover boards + hinge) + 0.2 mm per page** (Paper "Matte 200 g", 0.4 mm per sheet), with the page count clamped to 20–120 because short books print padded to the 20-page block — 12 mm at 20 pages (the kit's "12 mm"), 32 mm at 120. The inspector text, cover canvas spine and cover card ratio all use it; the legacy `cover.style.spineWidthMm` is kept for old documents and ignored (`src/core/pages.ts`).

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

| Area                | Current (`src/`)                                                                                                                                                                                               | Kit target (v0.9.3)                                                     | Gap                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Global tokens       | `styles/tokens.css` Theme B light (`@theme` / Procreate-light); Inter + Lora self-hosted; `?specimen`                                                                                                          | Kit `@theme` / Procreate-light (`ui-tw-bridge-v093`)                    | Done (this change) — kit values win where they differ                        |
| Tailwind utilities  | Tailwind 4 + `@tailwindcss/vite`; `styles/app.css` entry; preflight omitted; `src/ui/cn.ts` (`cn` / `cva`); no `uikit/src` imports                                                                             | Tailwind 4 + kit utilities (`ui-tw-bridge-v093`)                        | Done (this change) — foundation for ported JSX                               |
| Buttons             | Action primitives in `src/ui` (`default`/`secondary`/`ghost`); chrome still has duplicated `.editor-action*` until adoption                                                                                    | Button / IconButton / Toolbar primitives                                | Adopt in editor chrome; drop per-surface copies                              |
| Hardcoded colour    | Chrome CSS uses semantic vars; enforced by `scripts/check-css-tokens.mjs`                                                                                                                                      | Semantic roles (`--destructive`, `--background`, `--paper`, …)          | Done for listed chrome CSS                                                   |
| Radius              | Chrome uses `--radius-*`                                                                                                                                                                                       | `--radius-*`                                                            | Done for listed chrome CSS                                                   |
| Focus               | `--ring` focus-visible on chrome controls                                                                                                                                                                      | `--ring` focus-visible rings                                            | Done for listed chrome CSS                                                   |
| Home                | EmptyState + Button (+ Status hints); token chrome                                                                                                                                                             | Tokens + EmptyState / Button; `uikit#/feature/project-screens-adoption` | Done (project-screens-adoption); screen rebuild in M2.6                      |
| Feedback + overlays | Editor chrome: filmstrip `Status`+`ProgressBar`, Placed `Badge`, empty `EmptyState`, pasteboard empty card + placement hint, import-error `Toast` + grouped errors Dialog; canvas drop/select/focus via tokens | Kit toast/badge/progress/EmptyState/overlays + `editor-chrome-states`   | Done (chrome states + empty hints + import-errors)                           |
| Permission / lock   | Quiet `Status` banner + one primary Grant `Button` (kit AppModal = specimen)                                                                                                                                   | Quiet banner + one primary                                              | Done (project-screens-adoption)                                              |
| Save indicator      | `Status` + phase-colored `Badge` (dot)                                                                                                                                                                         | Status tokens / Badge                                                   | Done (project-screens-adoption)                                              |
| Missing assets      | Relink on `Dialog` + row `Badge`                                                                                                                                                                               | Relink Dialog pattern                                                   | Done (project-screens-adoption)                                              |
| Welcome / first-run | Kit first-run chrome in `WelcomeScreen` (hero, Create Library, plain credit)                                                                                                                                   | `uikit#/screen/first-run`, `uikit#/demo`                                | Done (`ui-welcome-v93`)                                                      |
| Unsupported browser | Kit screen + `getBrowserSupport` gate (`FeaturedIcon`, CTAs, variants)                                                                                                                                         | `uikit#/screen/unsupported-browser`                                     | Done (`ui-unsupported-v93`)                                                  |
| Empty library       | Kit empty chrome + Create book dialog (title + page size)                                                                                                                                                      | `uikit#/screen/home` (empty) + Create book dialog                       | Done (`ui-library-empty-v93`)                                                |
| Library grid        | Kit book tiles + search/sort + card menu (Open/Rename/Duplicate/Remove) + Change-library confirm                                                                                                               | `uikit#/screen/home` book objects + search/sort                         | Done (`ui-library-grid-v93`)                                                 |
| Library chrome      | Desktop Create/Search/Sort/gear visibility; book-shaped covers + Lora italic; `N pages · edited …`; Inter/Lora weight/italic parity (`font-synthesis-weight`)                                                  | `uikit#/demo` library-with-books                                        | Done (`ui-library-chrome-v93`)                                               |
| Settings            | Kit Settings shell; Library live (path, count, Change FSA); Hosting/Site/Print/Interface deferred                                                                                                              | `uikit#/screen/settings`, `uikit#/demo`                                 | Done (`ui-settings-stub-v93`)                                                |
| Editor shell        | Kit `EditorFrame` regions (top / left spreads / canvas Pasteboard / dock Filmstrip / inspector stub) + working import/place                                                                                    | `uikit#/full/editor`, `uikit#/screen/editor`, `uikit#/demo`             | Done (`ui-editor-shell-v93`); hard-nos → Package J                           |
| Editor hard-nos     | Tone `#CACACA` select; Space-pan; plain wheel zoom; no Replace; status-line folder msgs; black used badges; pasteboard Crop (no floating Crop)                                                                 | v0.9.x hard-nos in `uikit/README.md`                                    | Done (`ui-editor-parity-v93`); inspector Fit & crop (`look-parity-fit-crop`) |
| Buttons / overlays  | `src/ui` primitives; some duplicated chrome CSS                                                                                                                                                                | Kit Button / Toolbar / overlays                                         | Come along with screen ports                                                 |
| Filmstrip           | Token chrome; geometry custom; place/crop logic works                                                                                                                                                          | Kit filmstrip dock + tone-only selection / ThumbGrid / PhotoThumb       | Align in editor shell / parity                                               |
| Spread / pasteboard | `--canvas` / `--select` / `--ring`; paper from document                                                                                                                                                        | `--canvas` / `--select` / `--ring`; paper from document                 | Done for chrome colours                                                      |
| Theme               | Single Theme B light on `:root`; no toggle / persistence                                                                                                                                                       | Single Procreate-light                                                  | Done (single-theme); bridge locks kit hex                                    |
| Icons               | `Icon` + in-repo glyphs; size tokens 14/16/20; `?specimen` grid                                                                                                                                                | In-repo SVG (kit lucide is reference only)                              | Done — do not add `lucide-react` to the app                                  |
| Site / print UI     | Not started                                                                                                                                                                                                    | `uikit#/screen/showcase-site`, `print-prep`, `print-export`             | **Not now** (parked)                                                         |

UI ref for target screens: `uikit#/demo`, `uikit#/full/editor`, `uikit#/screen/first-run`, `home`, `settings`, `unsupported-browser`, `editor`; also M2.5 specimens `design-tokens`, `icon-set`, `editor-chrome-toolbar`, `editor-chrome-states`, `project-screens-adoption`.
