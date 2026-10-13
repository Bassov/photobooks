# Proposal

## Why

- **Problem:** Reviewers and contributors have no HTTPS preview URL per PR/branch. Secure-context APIs (`showOpenFilePicker`) and real-device checks need a public preview, not only localhost.
- **Why now:** Vite static app is ready to ship previews; Cloudflare plugin/MCP is available. Prefer Workers + Static Assets (current Cloudflare guidance for new sites) over Pages.

## What Changes

### Scope in

- Host the production Vite build as a Cloudflare Worker with Static Assets (SPA routing).
- Connect the GitHub repo to Workers Builds: production deploy from `main`, preview builds for non-production branches/PRs.
- Rely on Workers Builds GitHub PR comments (commit + branch preview URLs); no custom comment bot.
- Document connect/build/preview setup for contributors (README).

### Scope out

- Custom domains, Cloudflare Access, Workers Functions/API, R2, analytics, Pages project, Vercel/Netlify.
- Changing app runtime behavior beyond what static hosting requires.
- Replacing existing GitHub Actions verify/LHCI/Stryker jobs.

## Capabilities

### New Capabilities

- `preview-hosting`: HTTPS production and per-branch/PR preview hosting for the static SPA, with discoverable preview links on pull requests.

### Modified Capabilities

- (none)

## Success criteria

- Push/merge to `main` deploys a working HTTPS production URL.
- After a successful preview build, Cloudflare posts a PR comment with a reachable preview URL.
- Preview and production serve the SPA correctly (client routes / refresh do not 404).
- Existing CI (`checks`, `integration`, `lighthouse`, `stryker-diff`) remains unchanged in purpose.

## Risks

- First-time GitHub ↔ Cloudflare authorization and Workers Builds settings are dashboard steps that cannot be fully automated from the repo alone.
- Free-tier build minutes / concurrency limits under heavy PR traffic.
- SPA fallback / deep-link misconfiguration breaks refresh and client routes on preview/prod.

## Impact

- Adds Wrangler/Workers Static Assets config and short hosting docs; optional `wrangler`/`@cloudflare/vite-plugin` only if needed for local/CI deploy.
- Cloudflare account + GitHub app install required once; no change to local-first app domain logic.
