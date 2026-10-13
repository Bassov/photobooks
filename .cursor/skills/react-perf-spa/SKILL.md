---
name: react-perf-spa
description: >-
  SPA React performance for Photobooks — bundle size, re-renders, event-handler
  logic, Web Workers. Use when optimizing Vite+React performance, LoAF, or
  reviewing expensive UI work. Not for Next.js SSR/RSC or server caches.
---

# React performance (SPA)

Inspired by Vercel React best practices; SPA-only subset.

## Critical

- **Workers**: decode/render/orientation off main thread; keep main thread ≤ LoAF 200 ms blocking.
- **No waterfalls in UI**: do not chain awaits that could start together when loading local files or worker jobs.
- **Bundle**: avoid barrel re-exports that pull unused modules; prefer direct imports for heavy libs.
- **Lazy**: route- or feature-level `React.lazy` + `Suspense` when a capability is large.

## Re-renders

- Put interaction logic in event handlers, not in render-time sync work.
- Do not add `useMemo` / `useCallback` / `memo` by default; follow React Compiler guidance in this repo.
- Prefer derived state during render over effect mirrors.

## Assets

- Object URLs: revoke when discarded; do not keep unbounded blob URL maps.
- Prefer transferring `ArrayBuffer` to workers over cloning large buffers.

## Out of scope here

SSR, RSC, `after()`, cross-request server LRU, Next `optimizePackageExports` as a hard requirement (use Vite equivalents when needed).
