# src/components/ui — JollyUI, ported to Tailwind v4 / React 19

Source: JollyUI (https://github.com/jolbol1/jolly-ui, `src/registry/default/ui/*`, MIT, © 2024 James Shopland —
see `LICENSE-jollyui-MIT.txt`). JollyUI is shadcn/ui rebuilt on react-aria-components; like shadcn it is
"copy the code into your repo", so these files are **owned by this project** from now on and edited freely.

Ported on 2026-10-16 to: Tailwind CSS 4.3 (CSS-first `@theme`, no tailwind.config), React 19.3,
react-aria-components 1.22.1, tw-animate-css 1.4 (replaces tailwindcss-animate), class-variance-authority 0.7.

| file | exports |
|---|---|
| button.tsx | Button, buttonVariants (default / destructive / destructive-outline / destructive-ghost / outline / secondary / ghost / link; sizes default, sm, lg, icon). Filled `destructive` is for the confirm button inside an AlertDialog only (kit v3). |
| toggle.tsx | Toggle, ToggleButtonGroup, toggleVariants |
| toolbar.tsx | Toolbar |
| tabs.tsx | Tabs, TabList (size sm / md / lg), Tab, TabCount, TabPanel. Kit v3: track + tab geometry live in the primitive (equal inset, centred content) |
| menu.tsx | MenuTrigger, MenuPopover, Menu, MenuItem (variant="destructive"), MenuSeparator, MenuHeader, MenuKeyboard, MenuSection, MenuSubTrigger, JollyMenu |
| select.tsx | Select, SelectTrigger, SelectValue, SelectPopover, SelectListBox, SelectItem, SelectHeader, SelectSection, JollySelect |
| list-box.tsx | ListBox, ListBoxItem, ListBoxHeader, ListBoxSection, ListBoxCollection |
| popover.tsx | Popover, PopoverDialog, PopoverTrigger |
| dialog.tsx | DialogTrigger, DialogOverlay, DialogContent (incl. sheets), DialogHeader, DialogFooter, DialogTitle, DialogDescription |
| tooltip.tsx | Tooltip, TooltipTrigger |
| slider.tsx | Slider, SliderTrack, SliderFillTrack, SliderThumb, SliderOutput |
| switch.tsx | Switch |
| checkbox.tsx | Checkbox, CheckboxGroup, JollyCheckboxGroup |
| field.tsx | Label, labelVariants, FieldGroup, fieldGroupVariants, FieldError, FormDescription |
| textfield.tsx | TextField, Input, TextArea, JollyTextField |
| numberfield.tsx | NumberField, NumberFieldInput, NumberFieldSteppers, NumberFieldStepper, JollyNumberField |
| searchfield.tsx | SearchField, SearchFieldGroup, SearchFieldInput, SearchFieldClear, JollySearchField |
| disclosure.tsx | Disclosure, DisclosureHeader, DisclosurePanel, DisclosureGroup |
| grid-list.tsx | GridList, GridListItem |
| progress.tsx | Progress, JollyProgressBar |
| separator.tsx | Separator |
| toast.tsx (+ toast.css) | **not JollyUI** (it has no toast): React Aria Tailwind Starter Toast recipe, Apache-2.0 (`LICENSE-react-spectrum-Apache-2.0.txt`), restyled to the JollyUI look |

## What the port changed
1. Tailwind v3 → v4 class renames (same rules shadcn used for its v4 migration):
   `outline-none` → `outline-hidden`, `shadow-sm` → `shadow-xs`, `w-[--var]` → `w-(--var)`, `flex-shrink-0` → `shrink-0`.
   `data-[hovered]:` / `data-[selected]:` etc. are unchanged and work natively in v4.
2. `"use client"` dropped (Vite SPA); registry imports `@/registry/default/ui/x` → `./x`.
3. Animations: `animate-in fade-in-0 zoom-in-95 slide-in-from-*` come from tw-animate-css.
4. Tokens: JollyUI's shadcn roles (background, foreground, card, popover, primary, secondary, muted, accent,
   destructive + *-foreground, border, input, ring, --radius) are declared in `src/index.css` via `@theme inline`.
5. Fixes / additions:
   - `SliderThumb` now forwards its props (`index`), so two-thumb range sliders work.
   - `Checkbox` called `cn(labelVariants)` (the function) — label styles were silently dropped; now `labelVariants()`.
   - `Switch` gained `size="sm"` (h-5 w-9) for dense inspectors.
   - `menu.tsx`: `MenuSection` was aliased to `ListBoxSection` and crashed inside a `Menu` ("reading 'collection'"); it is now `react-aria-components` `MenuSection`.
   - Kit v3: `tabs.tsx` — `TabList size` (sm 28 / md 32 / lg 40), equal track inset, tabs stretch to the track and centre
     their content (`items-center`, `leading-none`), new `TabCount`; call sites no longer pass heights/paddings.
   - Kit v3: `button.tsx` — `destructive-outline` / `destructive-ghost` variants; filled `destructive` uses the
     `--destructive-solid` token. `menu.tsx` — `MenuItem variant="destructive"`.
6. No other API changes; app-level density (h-8 controls, 13 px text) is applied by className at the call site
   or in `src/components/app/*`, so these files stay diff-able against upstream JollyUI.
