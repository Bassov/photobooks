# Design

## Context

See proposal.md — Why. The app is a Vite + React SPA (`pnpm build` → `dist/`). There is no Wrangler/Workers config yet. GitHub Actions already run verify/LHCI/Stryker; hosting must not replace those jobs. Cloudflare MCP/plugin is available for account ops and docs.

## Goals / Non-Goals

**Goals:**

- Assets-only Worker serving `dist/` with SPA fallback.
- Workers Builds GitHub integration: deploy `main`, preview non-production branches, native PR comments with preview URLs.
- Minimal repo config + README so a human can finish the one-time Cloudflare/GitHub connect.

**Non-Goals:**

- Worker `main` script, APIs, bindings, custom domains, Access.
- Custom GitHub Action that posts preview comments (Workers Builds already does).
- Migrating CI verify jobs onto Cloudflare builds.

## Decisions

1. **Workers Static Assets over Pages**  
   Cloudflare recommends Workers + Static Assets for new sites; Pages remains for existing Pages projects. Same preview/PR-comment outcome via Workers Builds.  
   _Alt considered:_ Cloudflare Pages — rejected for new greenfield hosting.

2. **Assets-only Worker (no `main`)**  
   Photobooks needs static hosting only. Configure Wrangler assets with `directory: ./dist` and `not_found_handling: single-page-application`. No Worker script until an API is needed.  
   _Alt considered:_ Cloudflare Vite plugin + Worker entry — deferred; adds DX surface without product need.

3. **Workers Builds for deploy + PR comments**  
   Connect the GitHub repo in the Cloudflare dashboard; enable non-production branch builds. Build command: `pnpm install && pnpm build`; deploy via Wrangler as configured by Workers Builds. Rely on Cloudflare’s GitHub PR comment (commit + branch preview URLs).  
   _Alt considered:_ GitHub Action + `wrangler deploy` + custom comment — more secrets/maintenance for the same UX.

4. **Config file: `wrangler.jsonc` in repo root**  
   Check in minimal assets-only config so Builds and local `wrangler deploy` share one source of truth. Keep Worker name stable (e.g. `photobooks`).

## Risks / Trade-offs

- [Dashboard auth cannot live in git] → Document exact connect steps; use Cloudflare MCP/dashboard for the one-time link.
- [Free build minutes] → Keep build lean (`pnpm build` only on Cloudflare; tests stay on GitHub Actions).
- [SPA deep-link 404] → Require SPA `not_found_handling`; verify refresh on a client path after first deploy.
- [workers.dev subdomain sharing] → Accept `*.workers.dev` until a custom domain is a separate change.

## Migration Plan

1. Add Wrangler config + README hosting section; optionally add `wrangler` as a devDependency for local deploy checks.
2. In Cloudflare: create Worker (or import from config), connect GitHub, set build/output, enable branch previews.
3. Push a throwaway PR; confirm PR comment + preview HTTPS; merge and confirm production URL.
4. Rollback: disconnect Git integration or pause builds in Cloudflare; app and GitHub CI keep working offline.

## Open Questions

- Exact Cloudflare account/project naming and whether `workers.dev` subdomain is already claimed — resolve at connect time via dashboard/MCP.
