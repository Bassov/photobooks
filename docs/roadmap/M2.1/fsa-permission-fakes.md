# fsa-permission-fakes

Tag: prep
Milestone: M2.1
Title: unit-level File System Access fakes (issue #72 L)
Status: done

## Scope

- [x] Fake directory picker and handles in a `*.test-helpers.ts`, built on `project/fsa/memoryDirectory.ts` and `browserDirectory.test-helpers.ts`: `queryPermission` / `requestPermission` with `granted` / `prompt` / `denied` (scriptable per call), and picker cancel as `AbortError`
- [x] Contract tests for the fake. Existing FSA adapter tests reuse it instead of local ad-hoc permission stubs
- **Done when:** a Vitest test can run the deny, prompt-then-deny, cancel and re-grant paths of the FSA library adapter with no browser.
