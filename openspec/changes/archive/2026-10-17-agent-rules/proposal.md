# Proposal

## Problem

Agents weaken failing gates via config, grow PRs past the size budget, and treat blocking reviewer findings as optional. Unattended runs also stop on security-tagged items even though Security Review already gates archive.

## Why now

M2.1 needs agents to keep gates ratchet-only, grow the roadmap instead of the PR, and resolve reviewer findings themselves (issue #72 E) before mechanical CI ratchets land.

## Scope in

- Quality bar, lessons, one AGENTS line: never weaken gates for any reason (incl. looser assertions/retries/skip); no Stryker disable until `stryker-diff-gate` defines a budget — fix with code, tests, or a seam
- Growth rule in config + roadmap Change size: over budget or deferred findings → `pnpm roadmap add --after`, finish within limit; line counts SoT in RULES.md
- Unattended command: continue security-tagged / security-surface items via Security Review; until ratchet merges, gate-config edits need stricter+touch-set or stop; until dependency-policy, new deps need audit:ci + Security Review. git-finish: red CI → code/tests only
- Blocking critical/high reviewer findings fixed or next checkboxes; PR records verdicts and dispositions
- Design touch-set names gate-file edits with reasons; implementation reviewer: high only for missing/unreasoned/weaker gate edits
- Dry-run in the change: oversized overflow becomes the next checkbox, not a larger PR

## Scope out

- CI ratchet / gate-value machinery; adversarial-reviewer agent body; app runtime / UI / deps

## Success criteria

- Mandates load from named config/docs; AGENTS ≤150 lines nav-only
- Unattended stop list omits security-tagged; Security Review gates tagged items and security-surface changes
- Gate-edit severities narrowed; design requires gate edits in touch-set with reasons
- Dry-run shows real scratch `pnpm roadmap add --after` output for overflow
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
