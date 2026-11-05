# roadmap-status-sync

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item roadmap-status-sync
Status: done

## Scope

Item files on main lag behind merged work, so `pnpm roadmap next` could offer finished features again. Done state lives in the item file (`Status: done`). Docs only: `docs/roadmap/**`.

- [x] Every open item file (no `Status: done`) outside the brief's do-not-mark list (`parent-overrides`, `live-captions`, `site-lightbox`, `printer-presets`, `cover-editor`, `site-preview-mode`, `avif-encoder`, `pdf-*`, `publish-*`, `in-app-publish`, `site-settings`, `publisher-targets`, `connect-own-hosting`, `booklet-imposition`) is checked against merged PRs on `origin/main`; `Status: done` is set only when its Done-when is met, else an `Audit` line lists what is left
- **Done when:** `pnpm roadmap check` green; `pnpm roadmap next` returns no item whose work is merged; the PR body has a slug → evidence → marked / left open table
- **Browser check:** n/a (docs only)
