---
name: react-composition
description: >-
  SPA React composition patterns for Photobooks — compound components, avoid
  boolean-prop sprawl, thin UI over domain hooks. Use when designing or
  refactoring React component APIs, splitting god components, or reviewing
  composition in Vite+React code. Not for Next.js/RSC.
---

# React composition (SPA)

Distilled for Photobooks (Vite + React 19). No Server Components.

## Prefer

- **Compound components** / explicit slots over `showX` / `variant` boolean piles.
- **Thin views**: UI reads props/hooks; domain logic in pure modules under `src/<capability>/`.
- **Custom hooks** for reusable stateful glue; keep hook surface small.
- **Children / render props** only when composition is clearer than more props.
- **One job per component**; split when a file mixes layout, I/O, and domain rules.

## Avoid

- God components (`App.tsx` owning all features).
- Prop APIs that encode every mode as booleans.
- Duplicating domain rules inside JSX.
- Premature Context for values used by one subtree.

## Photobooks notes

- Heavy work stays in workers; UI only shows model state (`PhotoCardModel`, etc.).
- Match existing capability folders; do not invent parallel trees.
