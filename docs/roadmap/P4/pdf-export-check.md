# pdf-export-check

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item pdf-export-check
Status: done

## Scope

- [ ] Worker check request (preflight + colorWarnings → preflightRows) and <library>/exports write
- **Done when:** unit + PBT on `preflightRows` (errors → warnings → info; page list ≤ 5 numbers then `+n`; every input issue in exactly one row; texts = Designer Spec pdf-export §2.1 item 7); a worker `check` message returns rows incl. a non-sRGB row for an Adobe RGB fixture and reads ≤ 256 KB per photo; `writeExport` tests on an in-memory folder: creates `exports/`, replaces a same-name file, NotAllowedError → access, QuotaExceededError → full, other → other
- **Browser check:** n/a (core, no UI; the Print dialog item drives it)
- **Kit components:** none (core, no UI)
- **Demo:** n/a (core)
- **Musts:** Designer Spec pdf-export PE6 (worker `check` = `preflight` + `colorWarnings`, ≤ 256 KB per photo via `blob.slice`, → `preflightRows` in pure `src/core/print/preflightText.ts`), PE7 (`<library>/exports/{slug}-{preset | w×h cm}.pdf`, D8 name rule, replace, errors → access / full / other)
- **Hard nos:** no UI, no new dependencies, no painter (`paintPdf.ts`) changes
- **Test:** unit + PBT on the pure modules; worker + writer unit tests; no e2e (no UI)
- **Depends:** pdf-color-tagging, preflight-core
