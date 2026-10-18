# Lesson 22

Cloudflare Workers Builds: do not pin Node via `.tool-versions` / asdf. The image rotates which exact patches are preinstalled (logs show “Detected nodejs@24.x” for the image default — that is not our pin). Official overrides are `.nvmrc` / `.node-version` / `NODE_VERSION` (major `22` is enough). asdf + an exact missing patch fails before `pnpm install`. Separate flake: `wrangler preview` can 504 — retry, not an app bug.
