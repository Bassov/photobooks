# deps-dev-unsafe-class

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item deps-dev-unsafe-class
Status: done

## Scope

- [ ] Land Dependabot #723 (dev group: vitest / @vitest/coverage-v8 5.1.1, dependency-cruiser 18.8.0, eslint-plugin-react-refresh 0.5.8, fast-check 4.11.0, knip 6.47.0, typescript-eslint 8.73.0, wrangler 4.166.0); `pnpm-lock.yaml` equals the Dependabot lockfile.
- [ ] typescript-eslint 8.73.0 enables `@typescript-eslint/no-unsafe-class-instance-assignment`: replace every flagged `as` cast to a class type with an `instanceof` guard that throws (no `eslint-disable`, no config change).
- [ ] No product behaviour change: test files only.
- **Browser check:** none (dev dependencies and unit tests only).

## Done when

- [ ] `pnpm lint` reports 0 errors from the new rule (CI `checks`); the changed unit tests pass.
