## Proposal

Roadmap: [`docs/roadmap/P2/remove-cursor-support.md`](../../../docs/roadmap/P2/remove-cursor-support.md) (scope / Done when SoT).

### Scope out

- Rig (`@albasov/ts-agent-rig`): its `.cursor/` budget patterns become dead; reported in the PR body.
- Mouse-cursor UI/CSS (`pasteboard` cursor, loaded-cursor queue).
- Headless launchers outside the repo.

### Delta / Risk

- `.claude/` agent/command/rule budgets rise to the moved `.cursor/` budgets; the total shrinks. PR carries the Owner-brief waiver line.
- Always-on rules rely on Claude Code's native `.claude/rules/` loading instead of `CLAUDE.md` imports.
