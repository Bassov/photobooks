## Proposal

Roadmap: `docs/roadmap/M2.2/ui-tw-bridge-v093.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Welcome / Library / Editor visual ports (later packages)
- lucide-react (keep in-repo `Icon`); unrelated roadmap reshuffles

### Delta / Risk

- Empty home + painter editor stay layout-green (no page scroll from Tailwind preflight); specimen proves `bg-chrome` / `bg-sel` / `text-muted-foreground`
- Security: new deps (`tailwindcss`, `@tailwindcss/vite`, `clsx`, `tailwind-merge`, `class-variance-authority`) → `pnpm audit:ci`
