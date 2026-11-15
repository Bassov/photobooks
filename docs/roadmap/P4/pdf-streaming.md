# pdf-streaming

Tag: contingency
Milestone: P4
Title: only if `pdf-export` peak memory is too high

## Scope

- [ ] Per-page chunks streamed to the file
- **Browser check:** a 40-spread export's peak memory stays below the threshold recorded in `pdf-export`.
- **Kit components:** none (contingency, no UI)
- **Demo:** n/a
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** pdf-export
- **Done when:** the 40-spread export of the `pdf-export` measure (159 distinct ~4.4 MB JPEGs, 78 sheets) grows peak ArrayBuffers by < 1 GB (before: +1.4 GB), with the booklet (imposed) peak measured too; concatenated chunks form a valid PDF with correct xref offsets for random page counts (unit / PBT); no long task from our code on the main thread during export, `PERF_BUDGETS` unchanged; `PrintButton.test.tsx` passes 20/20 in a loop; `e2e/print-dialog.spec.ts` and `e2e/print-perf.spec.ts` green.
