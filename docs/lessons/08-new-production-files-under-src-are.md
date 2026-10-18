# Lesson 08

New production files under `src/` are in mutation scope via the `stryker.config.json` globs. Exclude a file only when mutating it is pointless, with a one-line reason in `stryker.mutate.md`. `pnpm verify:fast` fails when a production file is neither covered nor excluded.
