# frame-styles

Tag: feature
Milestone: M4.5
Title: consistent frames across the book

## Scope

- [ ] Create / edit / apply frame styles from the inspector; editing a style updates every frame using it
- [ ] Spread background color
- **Perf:** a style edit re-renders only spreads that use it; strokes and mats are borders / insets, no blurred shadows. Gate: edit a style used on 40 spreads — zero LoAF.
- **Browser check:** give all photos a white 5 mm mat via one style, change it to 3 mm — every spread updates; set a dark spread background.
- **UI ref:** `uikit#/feature/frame-styles`
