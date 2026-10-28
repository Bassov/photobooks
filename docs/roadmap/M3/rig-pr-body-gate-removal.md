# rig-pr-body-gate-removal

Tag: prep
Milestone: M3
Title: ts-agent-rig: remove pr-body gate, optional finish --body-file, pin bump

## Scope

Owner-approved agent-pipeline-plan-2026-10-28 §2.2 rig side (ts-agent-rig repo): delete check-pr-body.mjs + test; drop pr-body entry in bin/gate.mjs and quality-self-check.mjs default row/checkPrBody call; pnpm agent finish --body-file optional, prefill from .github/PULL_REQUEST_TEMPLATE.md (Summary from commit subjects, OpenSpec from archived change, Manual test scenarios from tasks.md, Metrics); release v0.2.x and bump the photobooks pin (package.json, checks.yml/pr-policy.yml refs). Done when: template-only PR green on checks + pr-policy; gate-config PR without waiver still fails pr-policy.
