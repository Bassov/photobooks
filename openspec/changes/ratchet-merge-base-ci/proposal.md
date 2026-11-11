## Proposal

Roadmap: `docs/roadmap/P4/ratchet-merge-base-ci.md` (scope / Done when SoT). Rig PR: Bassov/ts-agent-rig#12.

### Scope out

- No `@albasov/ts-agent-rig` package bump; local `pnpm check` pr-policy unchanged.
- No rig merge or tag; the orchestrator swaps the sha pin to the release tag.

### Delta / Risk

- Security: immutable sha pin; PR head is data only, never executed.
- `pull_request_target` runs the workflow from `main`, so this PR's own pr-policy run still uses the `v0.2.21` pin. The first behind-main PR opened after merge proves the fix.
