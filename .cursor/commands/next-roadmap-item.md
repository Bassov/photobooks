# Next roadmap item (unattended)

Run ONE roadmap item end to end. `/next-roadmap-item <slug>` → `pnpm -s agent preflight --slug <slug>`; no slug → bare preflight (roadmap next + claimed set). This message authorizes plan → apply → manual → archive → PR (CI fix only in a CI-fix brief).

**Read first, and only:** [`docs/agent-loop.md`](../../docs/agent-loop.md) `## Must-read` (Read lines 1–28): flow, stop rules, output caps, shell rules. Open other loop headings by range on demand. Do not re-read this command, `AGENTS.md`, always-on rules, the item after preflight, `openspec/config.yaml` or `.cursor/agents`: rules and templates come from the run card or `pnpm -s agent instructions <artifact>`. Roadmap: skill `roadmap`. Finish precedence: `.cursor/rules/git-finish.mdc`. Ignore `openspec/changes/archive/**`.

- Batch independent reads in parallel; one Write per OpenSpec artifact; validate once per stage.
- Contingency: only when its gate failed (`pnpm -s roadmap show <slug>`). Prep/contingency fast-track and oversize → `pnpm roadmap add … --after`.
- Out-of-scope fails: fix here unless the same failure is on unmodified `origin/main`; else `pnpm roadmap add … --after` or a bug issue — filing never greens a red PR.
- Security-tagged: Security Review before archive. Gate-config edits must be stricter and touch-set listed. New/changed deps: `pnpm audit:ci` + Security Review.
- After the PR URL: exit. `ci-wait` only if the brief asks; never `gh pr checks --watch`.

Final reply in Russian: item, PR URL, required-check status, reviewer verdicts, skipped survivors, assumptions.
