## Proposal

Roadmap: [`docs/roadmap/M2.5/import-errors-panel.md`](../../docs/roadmap/M2.5/import-errors-panel.md). UI ref: `uikit#/feature/editor-chrome-states`.

### Scope out

- Toast look/tokens/Placed badge (`editor-chrome-states`)
- HEIC copy/signature (`heic-unsupported-message`); blank-tile removal (`failed-import-no-tile`)
- Decode/FSA pipeline beyond tagging `reason`/`id`/`assetId`

### Delta / Risk

- E2e: empty after Clear all; happy grouped counts; interact dismiss+jump (filmstrip scrollport; no page H/V).
- Security: UI/store only; tag fields on existing errors.

**Size estimate:** = 450 (prefer ≤1500; advisory)
