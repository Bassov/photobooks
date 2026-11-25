# prod-qa-walkthrough

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item prod-qa-walkthrough

## Scope

Owner 2026-11-25: QA pass on the real prod deploy (https://photobooks.photobooks-bassov.workers.dev) through every chapter of the product walkthrough (`uikit/src/kit/guide/content.ts`) and the tools added since 2026-11-20, with a written bug report. Finds and documents bugs only; each bug becomes its own fix item.

- [x] Report `docs/qa/prod-qa-2026-11-25.md`: summary (prod build seen, date, viewports, counts), bugs `QA-n` (severity, chapter, repro, expected, actual, evidence, likely source, fix size, e2e coverage), passed chapters, not testable / needs Owner
- [x] Every walkthrough chapter (create-book … hosting) and every post-11-20 tool has a result
- [x] Playwright script `docs/qa/prod-qa-2026-11-25/run.mjs` (not CI) + ≤30 jpg screenshots ≤150 KB each
- **Browser check:** the QA run itself on prod (1440×900, plus 1280×800 and DPR 2 for the editor)
- **Done when:** each bug has repro steps a fix brief can use without rerunning the QA; PR `docs(qa): prod walkthrough QA report 2026-11-25`
- **Hard nos:** touch only `docs/qa/**` and this item; no `src/`, `uikit/`, `e2e/`, `package.json`, lockfile; no real Cloudflare credentials, no publish, no print order, no secret files
