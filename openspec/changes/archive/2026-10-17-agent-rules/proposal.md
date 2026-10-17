# Proposal

## Problem

Agents weaken failing gates via config, grow PRs past the size budget, and treat blocking reviewer findings as optional. Unattended runs also stop on security-tagged items even though Security Review already gates archive.

## Why now

M2.1 needs agents to keep gates ratchet-only, grow the roadmap instead of the PR, and resolve reviewer findings themselves (issue #72 E) before mechanical CI ratchets land.

## Scope in

- Quality bar, lessons, one AGENTS line: never weaken coverage/mutation/lint/type gates to pass — fix with code, tests, or a seam (equivalent-mutant disables stay in later budget)
- Growth rule in config + roadmap Change size: over budget or deferred findings → `pnpm roadmap add --after`, finish within limit
- Unattended command: continue security-tagged items via Security Review; no stop for gate-config (ratchet stricter-only). git-finish: red CI → code/tests only
- Blocking critical/high reviewer findings fixed or next checkboxes; PR records verdicts and dispositions
- Design touch-set names gate-file edits with reasons; implementation reviewer documents gate-edit severities
- Dry-run in the change: oversized overflow becomes the next checkbox, not a larger PR

## Scope out

- CI ratchet / gate-value machinery; adversarial-reviewer agent body; app runtime / UI / deps

## Success criteria

- Mandates load from named config/docs; AGENTS ≤150 lines nav-only
- Unattended stop list omits security-tagged; Security Review remains archive gate for security surface
- Gate-edit severities documented for implementation review; design requires gate edits in touch-set
- Dry-run shows `pnpm roadmap add --after` for overflow
- `agent-context` delta covers the above; `pnpm verify:fast` green

## Risks

- Soft rules until mechanical ratchets land — accepted for this prep
- Skipping Security Review if agents ignore config — existing archive mandate remains

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `agent-context`: non-weaken, growth/deferred via roadmap, unattended security-continue, reviewer disposition, gate-edit design/review rules

## Impact

Agent docs/rules/config and `agent-context` spec only; no app or CI runtime change.
