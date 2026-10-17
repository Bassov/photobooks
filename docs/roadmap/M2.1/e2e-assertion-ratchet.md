# e2e-assertion-ratchet

Tag: prep
Milestone: M2.1
Title: strict e2e helpers and tolerances can only get stricter (PR #76, #59)

## Scope

- [ ] Move geometry and frame-budget helpers (`spreadViewContained`, `assertDocumentFitsViewport`, `assertNamedScrollport`, frame-budget asserts) to `e2e/helpers/strict/*` with **self-tests on fixture pages that must fail** (2-px overflow, horizontal clip, zero-size element, a LoAF over budget). Self-test cases may only grow (superset rule)
- [ ] Pixel tolerances and non-default `expect` / `expect.poll` / `toPass` timeouts live in `quality/gates.json` (`e2e.tolerancePx`, `e2e.maxPollTimeoutMs`) and are ratcheted. ESLint `no-restricted-syntax` forbids inline numeric `timeout:` above the default in `e2e/**`
- [ ] Existing specs keep their assertions (no edits beyond imports); the 15 s settle polls already on `main` are recorded as the starting `maxPollTimeoutMs`
- **Done when:** replacing `spreadViewContained` with #76's intersect check fails a helper self-test, raising the tolerance from 1 to 2 px or adding `timeout: 30_000` fails `pr-policy`, and every existing spec stays green unchanged.
- **Size:** ~600 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** PR #76, PR #59
