# post-extract-docs-cleanup

Tag: prep
Milestone: M2.1
Title: Post-extract agent docs cleanup + retire roadmap archive
Status: done

## Scope

- [x] Pin `@albasov/ts-agent-rig` to v0.2.2 (roadmap archive → retire)
- [x] Delete `docs/roadmap/archive/`, remove `## Archive` from index, gitignore the path; `pnpm roadmap sync`
- [x] Fix stale agent pointers (overview/git-finish/testing/AGENTS/ci-gates/agent-context/config.yaml/RULES/roadmap skill)
- [x] Config debris: tsconfig load-gates include, unused `yaml`, playwright comment, diff-size description
- **Done when:** `pnpm check` and `pnpm roadmap check` green with no legacy archive; agent docs describe native OpenSpec + ts-agent-rig only

## Done note

Pinned rig v0.2.2; retired git-backed roadmap archive; fixed stale agent pointers
