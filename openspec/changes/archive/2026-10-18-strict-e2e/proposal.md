# Proposal

## Why

PR Playwright still uses global retries (2) plus leftover per-spec `retries: 2`, so flakes can hide behind green CI. M2.1’s review cut needs zero retries on PRs and an empty (or explicitly tracked) `@flaky` list. Flake-fix items already landed; this change ratchets the gate.

## What Changes

- **In:** Set Playwright CI retries to 0 on `pull_request` and `push`; delete every remaining per-spec `retries` override; use `trace: retain-on-failure`.
- **In:** Introduce `e2e/flaky.json` (empty preferred) and an `@flaky` CI job that may retry only those specs; CI report shows the `@flaky` list count. Any non-empty entry gets a fix roadmap checkbox immediately after this item. List may only shrink later (`gate-values-file` / ratchet).
- **In:** `write-tests` skill requires concrete e2e outcomes (`data-asset-id` / `src` / asset-in-frame), not counts alone; tighten PR #45 swap/move assertions accordingly.
- **Out:** Moving values into `quality/gates.json` (`gate-values-file`); gate-weakening AST guards; fixing product LoAF beyond relocating true leftovers into `@flaky` + follow-up items; editing `openspec/config.yaml` or `.cursor/agents`.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: Main PR/push e2e runs with zero retries; optional `@flaky` job + list; report shows `@flaky` count; burn-in wording no longer allows main-suite retries.
- `agent-context`: `write-tests` skill guidance requires concrete placement/swap/move identity assertions.

## Success criteria

- Main e2e on PR/push: retries = 0 everywhere (global + no per-spec overrides); traces retained on failure.
- CI report shows `@flaky` count (0, or each entry has a next roadmap checkbox).
- The `@flaky` job (when the list is non-empty) is required by `integration` so its failure fails the PR; empty list skips that job without weakening the main e2e gate.
- Keyboard swap/move specs assert which asset is in which frame (`data-asset-id`), not only counts/status text.
- No skip/fixme/longer timeouts/looser assertions to get green.

## Risks

- Removing retries may surface remaining flakes → must land in `e2e/flaky.json` with a follow-up item (never loosen the main suite).
- `@flaky` job must stay under the required `integration` gate so failures still fail the PR (no gate move/weaken).
