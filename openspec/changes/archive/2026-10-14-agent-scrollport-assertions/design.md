# Design

## Context

See proposal.md. Filmstrip containment is already in `editor-shell` + `e2e/filmstrip.spec.ts` (inline `documentElement` metrics). No shared page-fit helper. Proposal rules only require generic “observable UX”. Roadmap Browser checks mention stutter, not document containment. Happy-dom cannot catch CSS Grid min-content stretch.

## Goals / Non-Goals

**Goals:** shared Playwright page-fit helpers; wire existing scroll scenarios; config + `agent-context` mandates; roadmap/lessons/reviewer/skill nudges.

**Non-Goals:** product CSS; new CI jobs; visual regression; changing `editor-shell` product requirements.

## Touch-set

- `e2e/fixtures/assertDocumentFitsViewport.ts` — `assertDocumentFitsViewport(page)`, `assertNamedScrollport(page, testId)` (optional `scrollLeft` nudge for horizontal ports)
- `e2e/filmstrip.spec.ts` — replace inline metrics; call page-fit after bulk-perf gallery load
- `e2e/smoke.spec.ts` — page-fit after `goto('/')`
- `openspec/config.yaml` — proposal, design, apply, quality-bar lines
- `openspec/specs/agent-context/spec.md` (via delta sync on archive)
- `.cursor/agents/openspec-proposal-reviewer.md`, `openspec-implementation-reviewer.md`
- `.cursor/skills/write-tests/SKILL.md`
- `docs/roadmap.md`, `docs/lessons.md`

## Decisions

1. **Helpers under `e2e/fixtures/`** — matches photo fixtures; imported by specs. Compare `scrollWidth/Height <= clientWidth/Height` (subpixel-safe `<=`).
2. **Named scrollport by `data-testid`** — filmstrip uses `filmstrip-scroll`; pasteboard can pass its test id later. Horizontal nudge only when asserting overflow + scrollability.
3. **Bulk-perf also asserts page-fit** — #19’s LoAF scenario scrolled the strip while the page was wide; page-fit after `data-gallery-count` closes that hole.
4. **Config + delta `agent-context` only** — no `ci-gates` / `editor-shell` delta; product behavior unchanged.
5. **`ui-review` stays optional** — quality bar states Playwright is the overflow gate.

## Tests

| Surface               | Public contract                    | Assert                                         |
| --------------------- | ---------------------------------- | ---------------------------------------------- |
| Smoke                 | `editor-shell` visible             | document fits viewport                         |
| Filmstrip containment | gallery count + `filmstrip-scroll` | page-fit + named scrollport overflow           |
| Bulk perf             | gallery count 200                  | page-fit after load (plus existing LoAF gates) |

## Risks / Trade-offs

- [False positive from fractional pixels] → use `<=`, not strict equality.
- [Mandate applied to intentional document scroll] → scope rule to in-app scrollports only.
