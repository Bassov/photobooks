# Design

## Context

See proposal.md. `createFakeBrowserDirectory` (`browserDirectory.test-helpers.ts`) is an in-memory browser-shaped `FileSystemDirectoryHandle` without permission APIs. `createMemoryDirectory` covers the library protocol. `createFsaLibraryStorage` gates via test-only `setPermissionRequired` / `setLockedElsewhere`. `browserSessionState.test.ts` still has a local `queryPermission` stub — out of scope for this change (parallel allowlist: FSA helpers + FSA library adapter tests only). No product permission wiring (`skip_specs: true`).

## Goals / Non-Goals

**Goals:** One shared Vitest fake for FSA handle permissions + directory picker cancel; contract tests; `fsaLibraryStorage.test.ts` reuses it for Done-when paths (deny, prompt-then-deny, cancel, re-grant) without a browser.

**Non-Goals:** Session/browserSessionState stub migration; `projectSession` injection; e2e stubs; production permission prompts; `src/editor/**`, CI, package deps.

## Decisions

1. **Module** — Extend `src/project/fsa/browserDirectory.test-helpers.ts` only (tree I/O + permission + picker). Fallback split to `fsaPermission.test-helpers.ts` only if that file stops being one cohesive API; if split happens, list both paths in the touch-set before apply. Build trees via existing fake browser dir / `createMemoryDirectory`; do not fork a second fake FS.

2. **Permission scripting** — Each fake directory handle exposes `queryPermission` / `requestPermission` (default mode `readwrite`). Results are scriptable per call via an explicit queue, or `setPermission` for sticky state. Empty queue falls back to sticky. `requestPermission` → `granted` updates sticky so later queries see the re-grant.

3. **Picker** — `createFakeDirectoryPicker({ outcomes })` returns a function matching `showDirectoryPicker`: next outcome is a handle, or rejects `DOMException` named `AbortError`. Outcomes consumed in order.

4. **FSA library adapter paths** — Do not change production `createFsaLibraryStorage` permission logic. Adapter tests bridge fake → `setPermissionRequired` explicitly (visible in Arrange). Cancel is picker coverage in the same test file before storage bind, not an adapter return code.

## Touch-set

- `src/project/fsa/browserDirectory.test-helpers.ts`
- `src/project/fsa/browserDirectory.test-helpers.test.ts` (fake contract)
- `src/project/fsaLibraryStorage.test.ts` (Done-when matrix + reuse)
- `docs/roadmap/M2.1/fsa-permission-fakes.md` (scope ticks)
- `openspec/changes/fsa-permission-fakes/`

No quality-gate config edits.

## Composition

Test helpers only (`*.test-helpers.ts`); production must not import them. FSA library adapter tests import the helper. No new subsystem beyond the fake surface.

## Tests

**Public API:** fake exports from `browserDirectory.test-helpers.ts`; `createFsaLibraryStorage` via `setPermissionRequired` + storage methods. Reuse `makeBook`, `loadBookTextSync`, existing FSA harness. No e2e / UI / LHCI.

**Fake contract:** sticky + queued query/request; picker `AbortError`; re-grant updates sticky query.

**Done-when matrix (`fsaLibraryStorage.test.ts`):**

| Path             | Fake script                                                    | Bridge                         | Assert                                          |
| ---------------- | -------------------------------------------------------------- | ------------------------------ | ----------------------------------------------- |
| deny             | `queryPermission` → `denied`                                   | `setPermissionRequired(true)`  | list/create → `permission-required`             |
| prompt-then-deny | `query` → `prompt`, `requestPermission` → `denied`             | gate true                      | `permission-required`                           |
| cancel           | picker outcome `abort`                                         | (none — before bind)           | `AbortError`; no `createFsaLibraryStorage` call |
| re-grant         | after denied: `requestPermission` → `granted` (sticky updates) | `setPermissionRequired(false)` | list/create ok                                  |

## Security

FSA is the security surface. Helpers are Vitest-only; must not ship in production imports. No change to real picker / permission UX, CSP, or trusted paths.

## Risks / Trade-offs

- [Fake ≠ Chromium] → Contract + Done-when matrix; real-path e2e stays in `fsa-permission-e2e`.
- [Adapter boolean gate] → Intentional; matrix makes the fake→`setPermissionRequired` bridge test-visible (not a second hidden stub). Follow-up: `project-session-deps`.

## Migration Plan

Additive test helpers. Rollback = revert PR.
