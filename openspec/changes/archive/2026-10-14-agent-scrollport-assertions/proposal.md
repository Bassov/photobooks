# Proposal

## Problem

PR #19 shipped a filmstrip that looked scrollable in e2e (element scroll works; LoAF passes) while the document itself grew wider than the viewport. Product containment is fixed (#20); the agent/e2e pipeline still does not require scrollport success criteria or a shared page-fit assert, so the same class of bug can pass again on pasteboard and later scroll UIs.

## Why now

Next M1 feature (`pasteboard-workspace`) adds another scrollport. Lock pipeline guards before that work, while the filmstrip regression is fresh.

## Scope in

- Shared Playwright asserts: document fits viewport; named scrollport overflows when expected
- Call sites: filmstrip containment, bulk-perf after gallery load, smoke (empty shell)
- OpenSpec proposal/design/apply mandates for scrollport UI; delta `agent-context`
- Proposal/implementation reviewer nudges; `write-tests` e2e guidance
- Roadmap Browser checks (filmstrip + pasteboard + how-to); one lessons line

## Scope out

- Product CSS / Virtualizer / `editor-shell` behavior (already specified)
- Visual regression suite; new CI jobs; `ci-gates` / Codecov
- Making `ui-review` a hard gate for overflow
- Production `src/` runtime changes

## Capabilities

### Modified Capabilities

- `agent-context`: scrollport success criteria in proposals; Playwright page-fit lock-in via shared helpers; page overflow is not a `ui-review` gate

## Success criteria

- Shared Playwright page-fit and named-scrollport asserts exist and are used from filmstrip containment, bulk-perf after gallery load, and smoke
- Proposal rules require no page H/V scroll + named scrollport when a scrollport is in scope
- Roadmap Browser checks for filmstrip and pasteboard mention document containment
- `agent-context` delta merged on archive

## Risks

- Over-applying page-fit asserts to intentional future full-page scroll surfaces — limit mandate to changes that introduce/change an in-app scrollport
