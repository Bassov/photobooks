# Design

## Context

See proposal.md. PR #15 already wires Test Analytics + Components. Checks run `pnpm build` without `CODECOV_TOKEN`. No bundler plugin yet. App uses React Compiler (`oxc-transform-react`) — must not drop that dep when adding the plugin.

## Goals / Non-Goals

**Goals:** Upload Vite app bundle stats to Codecov from CI builds; skip quietly without token; informational status only.

**Non-Goals:** Hard bundle gate; replacing LHCI; multi-bundle matrix.

## Decisions

1. **`@codecov/vite-plugin` after `react()`** — `bundleName: "photobooks"`, `enableBundleAnalysis: Boolean(process.env.CODECOV_TOKEN)`, spread `uploadToken` only when the env var is a non-empty string (satisfies `exactOptionalPropertyTypes`), `gitService: "github"`, `telemetry: false`. Plugin peers Vite 4–6 only; allow Vite 8 via `pnpm.peerDependencyRules.allowedVersions` until upstream supports 8.

2. **Pass token only on checks Build step** — `env: CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}` on the existing Build step (not global job env). Leave LHCI workflow alone.

3. **`codecov.yml` bundle_analysis** — `status: "informational"`, `warning_threshold: "5%"`. Do not tighten `require_bundle_changes`.

4. **Composition** — config/CI only; no product modules. New **devDependency** only.

## Touch-set

- `package.json` / `pnpm-lock.yaml` — `@codecov/vite-plugin` + peer allow Vite 8
- `vite.config.ts` — plugin after react
- `.github/workflows/checks.yml` — Build env
- `codecov.yml` — `bundle_analysis`
- `openspec/specs/ci-gates/spec.md` — sync on archive

## Risks / Trade-offs

- [Plugin upload fails network] → informational status; verify in CI logs
- [Local build with leaked token] → enable only when env set

## Security

Reuse existing secret; never echo token. Prefer env injection on one CI step only.

## Migration Plan

Land on PR #15; confirm Codecov Bundles / PR comment after green build. Rollback: remove plugin + env + YAML section + dep.
