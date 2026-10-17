# agent-pipeline-token-check

Tag: prep
Milestone: M2.1
Title: Check one /next-roadmap-item run against issue #77 targets

## Scope

- [ ] Run one `/next-roadmap-item` (or equivalent unattended session) after a comparable real item (e.g. `add-spread-reveal-flake`) is on `main` and check the transcript against issue #77 targets: no re-reads of injected files, `openspec/config.yaml` at most once, no untrimmed test/push/CI dumps, no out-of-scope-as-in-scope fixes, narrow reviewer briefs
- [ ] Record measured main input tokens vs the ~1.5M target for a comparable item; note survivors with one-line reasons
- **Done when:** one checked `/next-roadmap-item` run shows the hygiene rules held and main input is under ~1.5M for a comparable item (or documented why not, with follow-ups)
- Refs: https://github.com/Bassov/photobooks/issues/77
