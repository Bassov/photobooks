## Proposal

Roadmap: `docs/roadmap/M3/pr-body-free-form-tail.md`.

### Scope out

- ts-agent-rig changes (gate deletion, `finish` prefill, pin bump): `rig-pr-body-gate-removal`.
- Any other gate or threshold.

### Delta / Risk

- Docs/config wording only, plus `checks.yml` reads the waiver from the live PR (payload fallback, never looser).
- Security: PR body is untrusted; written to `$GITHUB_ENV` with a random delimiter so it cannot inject env lines.
