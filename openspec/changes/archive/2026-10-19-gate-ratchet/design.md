# Design

## Context

Gate thresholds live in `quality/gates.json` and `codecov.yml`. Reviews alone cannot stop weakenings (PR #93; PR #110). `scripts/check.mjs` already optionally loads `scripts/check-pr-policy.mjs` when present. `yaml` is only a Vite peer — not a direct import.

## Goals / Non-Goals

**Goals:** Base-branch `pr-policy` check refusing weaker-than-base gates; self-protecting rule/fixture supersets; `codecov.yml` validity in `pnpm check`; `ci-gates` requirements; fixture Done-when proofs.

**Non-Goals:** GitHub required-check settings (owner note only); `stryker-disable-budget` allowlist; product UI; other worktrees.

## Decisions

1. **`pull_request_target` + base checkout** — Checkout `github.event.pull_request.base.sha`, install **base** deps, fetch head SHA as objects. Job name `pr-policy`. Rejected: `pull_request` (head could rewrite the judge).

2. **One compare API** — `scripts/check-gate-ratchet.mjs` exports `compareGateTrees` + CLI (`--base-ref`/`--head-ref` or `--base-dir`/`--head-dir` for fixtures). Optional `scripts/check-pr-policy.mjs` entry for local `pnpm check`. Weakening inventory = roadmap Done-when + delta spec (not restated here).

3. **Self-protection** — Head exported `RULE_IDS` and fixture test ids MUST be supersets of base’s (parsed as text). No env/label override.

4. **Required-job gate steps** — `quality/gates.json` `requiredCheckJobs` lists current required job names. Static YAML: a gate step in a required job on base must stay there, or the required job `needs:` the mover and fails with it (no `continue-on-error`).

5. **`codecov.yml` in `pnpm check`** — `POST https://api.codecov.io/validate`; pass iff the **first line** of the body is exactly `Valid!` (API may append a config dump). On **network error only**, pinned top-level key allowlist; validation failures never fall back.

6. **YAML dep** — Exact-pin direct `yaml@2.9.1` (already in lockfile). `pnpm audit:ci`. No other new deps.

7. **Gate-config touch** — Add `requiredCheckJobs` only; no numeric/list threshold weakenings.

## Security

- Checkout and `pnpm install` only the **base** ref.
- Head: `git fetch` + `git show` / `git ls-tree` as data only — never checkout head as the execution worktree, never run head `package.json` scripts or head Node files.
- No workflow `inputs`, labels, or env flags that skip the ratchet.
- New direct dep `yaml@2.9.1`: run `pnpm audit:ci` before archive.

## Touch-set

| Path                                          | Reason                                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `.github/workflows/pr-policy.yml`             | `pull_request_target` base-only judge                                            |
| `scripts/check-gate-ratchet.mjs`              | ratchet compare + rule ids                                                       |
| `scripts/check-gate-ratchet.test.mjs`         | fixture Done-when on real script                                                 |
| `scripts/check-pr-policy.mjs`                 | optional local check entry                                                       |
| `scripts/check-codecov-yml.mjs`               | Codecov Valid! + network-only fallback                                           |
| `scripts/check-codecov-yml.test.mjs`          | unknown key / main / fallback                                                    |
| `scripts/check.mjs`, `scripts/check.test.mjs` | CORE_CHECKS codecov-yml                                                          |
| `quality/gates.json`                          | `requiredCheckJobs` (structure only)                                             |
| `package.json`, `pnpm-lock.yaml`              | pin `yaml@2.9.1`; scripts                                                        |
| `vite.config.ts`                              | coverage include for new scripts                                                 |
| `stryker.config.mjs`                          | unchanged mutate globs (ratchet covered by fixture tests; not in mutate this PR) |
| `openspec/specs/ci-gates/spec.md`             | archive sync                                                                     |
| `openspec/changes/gate-ratchet/**`            | planning + delta                                                                 |
| `docs/roadmap/M2.1/gate-ratchet.md`           | tick scope                                                                       |

## Risks / Trade-offs

- [YAML edge-case false negative] → `yaml` parse + Done-when fixtures.
- [Codecov API down] → network-error fallback only.
- [Owner forgets required check] → PR body setup note; job still runs.

## Open Questions

N/A
