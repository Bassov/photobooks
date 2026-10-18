# Proposal

## Problem

Book lock acquire/release, the "open in another tab" (`locked-elsewhere`) path, and permission re-grant still live inside the large project session module, so that logic cannot be mutated at the M2.1 bar on its own.

## Why now

M2.1 requires the stateful session path back in mutation scope behind unit-level fakes. Autosave is already extracted; locks and re-grant are the next prep slice.

## Scope in

- Pure extract of lock acquire/release, locked-elsewhere handling, and permission re-grant into a focused controller module
- Thin session delegation; public session API and lock/re-grant UX unchanged
- Focused controller unit tests; existing project-session integration suite stays in place (not moved)
- Reuse existing FSA permission fakes and injected platform deps; no new dependencies; do not rework `autosaveController`

## Scope out

- Lock/re-grant UX, Web Lock semantics, or durable permission flows
- Moving or rewriting `projectSession.test.ts` or `e2e/permissions-locks.spec.ts`
- UI chrome, CI gates, Playwright config, autosave controller rework

## Success criteria

- New controller module mutation ≥85 with zero NoCoverage; patch coverage ≥85
- `e2e/permissions-locks.spec.ts` and existing project-session lock/re-grant cases pass unchanged

## Risks

- Extract drift could drop an early return or reorder lock release vs autosave cancel — mitigated by controller tests plus unchanged integration and permissions-locks e2e
- Security: File System Access re-grant and book locks stay behind the same session entry points; no new handles, blob URLs, or permission prompts; behaviour unchanged
