## Decisions

1. **Reuse the core**: the card calls the merged `discover` / `runSetup` / `createCfApi`; the core stores the record, the UI reloads the summary. Rules the UI adds (token format, subdomain, host, row view) live in a pure `hostingSetupModel.ts`.
2. **Token custody**: Continue reads the uncontrolled password input once into `createCfApi(token)` and clears it; only that client (token in its closure) sits in a ref, dropped on step-1 Change, mode switch, unmount and success.
3. **Resume / cancel**: the setup plan (with the row-4 keys) stays in a ref so Try again resumes at the failed row; Cancel setup and unmount abort the run.
4. **Modes**: not connected keeps both the setup card and the manual form mounted (each keeps its values); Forget returns to the record's origin. Manual help items become `hosting-help-step-N` (kit name).
5. **Tokens**: kit / `docs/design.md` primitives only (chrome card, field box, Button, Badge, Icon); no new tokens.

## Touch-set & Test Plan

| Path                                   | Why                                                 |
| -------------------------------------- | --------------------------------------------------- |
| `src/editor/hostingSetupModel.ts`      | new pure model                                      |
| `src/editor/hostingSetupModel.test.ts` | unit + PBT                                          |
| `src/editor/HostingSetup.tsx`          | new setup card                                      |
| `src/editor/HostingSetup.test.tsx`     | component tests                                     |
| `src/editor/HostingSection.tsx`        | modes, intro, connected lines, Forget target        |
| `src/editor/hostingBits.tsx`           | Swap / CheckingLabel / Fail shared by form and card |
| `src/editor/hostingStyles.ts`          | shared classes (ERR, BOX, ring, CARD, MODE_LINK)    |
| `src/editor/HostingSection.test.tsx`   | fresh renders open the manual form                  |
| `src/editor/SettingsScreen.test.tsx`   | `hosting-setup` instead of `hosting-form`           |
| `src/publish/leakGuard.pbt.test.ts`    | setup token on success / failure / cancel           |
| `e2e/hosting-setup.spec.ts`            | new: flows, kit = prod DOM, paint, LoAF             |
| `e2e/hosting-settings.spec.ts`         | fresh-form tests open the manual form               |
| `e2e/in-app-publish.spec.ts`           | lands on `hosting-setup`                            |
| `openspec/specs/publish/spec.md`       | delta                                               |

- e2e: the Done-when list of the roadmap brief (happy, R2 off, no zone, DNS conflict resume, row 6 warning, widths, paint, LoAF).
