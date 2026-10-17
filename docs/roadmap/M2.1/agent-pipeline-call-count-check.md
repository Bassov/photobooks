# agent-pipeline-call-count-check

Tag: prep
Milestone: M2.1
Title: Check call-count + rtk trial for issue #79

## Scope

- [ ] Run one `/next-roadmap-item` (or equivalent) after `agent-pipeline-fewer-calls` is on `main` and check the transcript against issue #79 targets: preflight ≤ 2 model calls, commit → CI-green ≤ 4 on the happy path, main-agent model calls ≤ ~35 (vs 66)
- [ ] Trial `rtk-oss` on owner WSL (`rtk init -g --agent cursor`): which commands compress, tokens before/after vs 17 Oct transcript; adopt or drop (vs token-trim); document if adopt
- [ ] Record survivors with one-line reasons; close https://github.com/Bassov/photobooks/issues/79 when targets met or documented
- **Done when:** one checked run shows call-count targets (or documented why not with follow-ups) and an rtk adopt/drop decision is recorded
- Refs: https://github.com/Bassov/photobooks/issues/79
