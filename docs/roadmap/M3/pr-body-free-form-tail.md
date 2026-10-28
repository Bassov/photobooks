# pr-body-free-form-tail

Tag: prep
Milestone: M3
Title: Finish PR body free-form: docs and live-PR waiver in checks.yml
Status: done

## Scope

Owner-approved agent-pipeline-plan-2026-10-28 §2.1/§2.2 leftovers, photobooks side only:

- `docs/agent-loop.md`: drop "needs final PR body" (C2).
- `openspec/config.yaml`: drop "Copy into the PR body when drafting"; verdicts live in tasks.md / reviewer output, not the PR body (archive still needs the implementation-reviewer pass).
- `checks.yml`: read the waiver token from the live PR (`gh pr view --json body`) instead of the stale event payload (#249); payload is the fallback.

Rig-side work (delete `check-pr-body.mjs` + test, `bin/gate.mjs` / `quality-self-check.mjs` entries, `pnpm agent finish` optional `--body-file` with template prefill, rig pin bump) lives in the `ts-agent-rig` repo and is tracked by `rig-pr-body-gate-removal`.

## Done when

- A template-only PR is green on checks + pr-policy.
- A gate-config PR without the waiver still fails pr-policy.
- No other gate is loosened.
