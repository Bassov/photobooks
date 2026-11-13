# design-r25-publish-pill-kit

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item design-r25-publish-pill-kit
Status: done

## Scope

- [ ] Kit editor top-bar Publish pill (`uikit/src/demo-parts/editor.tsx`) drops its own hover rule and hovers like Preview, rgb(215) (Designer in-app-publish p4, M111); prod already does. Kit only, no `src/` edits.
- **Browser check:** kit `#/demo` editor: hovering Publish and Preview paints the same rgb(215) background; idle Publish keeps 73.58×32, padding 0 14.

## Done when

- Kit e2e: on `#/demo` editor, a clipped screenshot pixel of the hovered Publish pill is rgb(215) and equals the hovered Preview pill; idle Publish stays 73.58×32 with padding 0 14.
- No other pill's idle / hover / focus values change; prod untouched.
