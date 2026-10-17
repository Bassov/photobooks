# spec-trace

Tag: prep
Milestone: M2.1
Title: every spec scenario has a test or a waiver (#50 item 4)

## Scope

- [ ] `scripts/spec-trace.mjs` (`pnpm spec:trace`, in `checks` and the archive step): match `#### Scenario:` headings in `openspec/specs/**` to a `// spec: <capability>/<scenario>` tag or a test title in `src/**/*.test.*` and `e2e/**`
- [ ] `openspec/trace-waivers.yaml` for the current gaps, each with a reason. Waivers may only shrink (the ratchet), and new scenarios cannot be waived
- **Done when:** a new scenario with no test fails CI, and the CI report lists the remaining waived gaps.
