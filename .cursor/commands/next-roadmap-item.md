# Next roadmap item (unattended)

Run ONE docs/roadmap.md item end to end in this session. This message is the
explicit request for planning, apply, manual check, archive, PR and CI — do not
stop between stages. Mandates live in openspec/config.yaml (rules + operations),
.cursor/rules/git-finish.mdc and .cursor/agents; follow them, do not restate them.

1. Preflight: `git status` clean (else stop), then
   `git fetch origin && git switch main && git pull --ff-only`.
2. Pick the first top-level `- [ ]` in docs/roadmap.md. Skip items with an open PR
   or remote branch (`gh pr list --state open`, `git branch -r`) and [contingency]
   items whose gate has not failed. State item, tag, line and skips.
   `git switch -c feat/<name>` (fix/ for bug items).
3. Plan with the OpenSpec CLI, not /opsx-propose (its planning boundary would end
   this run): `openspec new change <name>`; for each ready artifact
   `openspec instructions <id> --change <name> --json` → write it →
   `openspec status --change <name> --json`. Launch the reviewer subagents where
   rules.proposal / rules.design require and loop to pass.
4. /opsx-apply <name> through the Verification checklist, including
   openspec-implementation-reviewer pass and the Manual check.
5. /opsx-archive <name>: answer "Sync now"; confirm only when every task is
   checked. Then the archive guidance (roadmap tick).
6. Commit, PR and wait for green per git-finish.mdc.

Stop and ask only for: dirty tree, a milestone review cut, a security-tagged item,
an item whose intent contradicts a spec or open issue, the git-finish CI stop
conditions. Otherwise record assumptions in the artifacts and continue.
Final reply in Russian: item, PR URL, check status, reviewer verdicts, skipped
survivors, assumptions.
