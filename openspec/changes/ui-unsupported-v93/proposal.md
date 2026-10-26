## Proposal

Roadmap: `docs/roadmap/M2.6/ui-unsupported-v93.md`. UI ref: `uikit#/screen/unsupported-browser`.

### Scope out

- Welcome / library / editor / site; no `WelcomeScreen.tsx`
- No `lucide-react` (extend in-repo `Icon` glyphs)

### Delta / Risk

- Empty: no FSA → kit unsupported; happy: Chromium → Welcome/library; interact: Get Chrome / Copy link / list (+ Reload on no-api). Scroll only in `unsupported-scroll`.
- Security: gate before IDB/permissions; no continue-anyway; CTA links `noopener`.
