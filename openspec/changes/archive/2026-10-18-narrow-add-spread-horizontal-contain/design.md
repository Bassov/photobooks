# Design

## Context

See proposal.md — Why. `revealLaidOutSpread` in `pasteboardReveal.ts` nudges once, then runs further nudges only when `after` fits **both** axes (`height && width` vs port + 1px). A height-fit / width-overflow (or tall / width-fit) box skips secondary horizontal (or vertical) correction. Existing e2e covers desktop fitted add with strict `spreadViewContained`; narrow ~400px and mid-scroll desktop paths are gaps. Lessons: do not loosen contain helpers; keep settle product logic in mutate scope; page containment via `assertDocumentFitsViewport`.

## Goals / Non-Goals

**Goals**

- Secondary (and follow-on) nudges when the box is not contained and at least one axis still fits the port (so single-axis overflow keeps correcting).
- Preserve oversized both-axes overflow → still not contained → false (incl. max-scroll clamp path).
- Playwright: narrow (~400px) fitted add + desktop mid-scroll fitted add; reuse `spreadViewContained`, `assertDocumentFitsViewport`, `assertNamedScrollport('pasteboard-scroll')`.
- Unit cases that fail on the old AND fits-gate.

**Non-Goals**

- New camera modes, scrollports, or Stryker/coverage gate edits.
- Changing the 1px contain tolerance shared with e2e.

## Decisions

1. **Gate = not-contained && (heightFits || widthFits)** — not both-axes AND. Alternatives: always secondary when `!contained` (more work on hopeless oversized boxes; max-scroll path already returns false); keep AND (fails the bug). Prefer OR so an axis that cannot fit still allows correcting the other.

2. **Keep `nudgeBoxIntoPort` axis rules** — per-axis fit → center; else edge-nudge. No new geometry helper.

3. **Composition** — pure settle stays in `pasteboardReveal.ts` (mutate); `usePasteboardReveal` / `Pasteboard` orchestration unchanged unless a wiring bug surfaces.

4. **Tests** — public API `revealLaidOutSpread` unit stubs (scroll tracks rect); e2e extends `e2e/spread-view.spec.ts`: (a) viewport ~400×720, Fit spread, then Add spread; (b) default desktop viewport, scroll pasteboard mid-stack, Fit spread, then Add spread. One fit mode each (Fit width only if Fit spread does not reproduce). Reuse `spreadViewContained` / document-fit helpers; no new helpers unless arrange repeats twice.

5. **UI smoke** — empty: default editor + document fit; happy: those two fitted-add paths; scroll: named pasteboard vertical scrollport. Skill `ui-review` layout smoke before push.

## Touch-set

- `src/editor/pasteboardReveal.ts` — fits-gate for secondary nudge
- `src/editor/pasteboardReveal.test.ts` — single-axis overflow + oversized regression
- `e2e/spread-view.spec.ts` — narrow Fit-spread add; desktop mid-scroll Fit-spread add (strict contain, no page H-scroll)
- `openspec/specs/editor-shell/spec.md` — via archive sync of delta
- `docs/roadmap/M2.1/narrow-add-spread-horizontal-contain.md` — scope ticks via apply / `pnpm roadmap done`

No quality-gate config edits.

## Risks / Trade-offs

- [Risk] Extra nudge on near-oversized boxes → Mitigation: both-axes oversized still skips secondary when neither axis fits; unit locks that path.
- [Risk] Narrow e2e flake from layout settle → Mitigation: reuse existing fit-fill poll + 15s contain poll; fix product, never loosen helpers.
- [Risk] Mid-scroll + fit interaction → Mitigation: scroll first, then fit, then add; assert contain on the new index.

## Migration

None — behavior fix only; rollback = revert PR.
