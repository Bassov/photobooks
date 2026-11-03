## Proposal

Roadmap: [`docs/roadmap/P2/design-r16-prod.md`](../../../docs/roadmap/P2/design-r16-prod.md). UI ref: `uikit#/demo`.

### Scope out

- `uikit/`, Print / Publish, the canvas dpi badge view flag.
- Clicking the pressed title keeps Book settings open (no toggle-off).

### Delta / Risk

- e2e: empty (24 MP, no chip, `aria-pressed=false`), happy (chip, pressed fill), interact (1024 / 1233 px one line; Contact sheet right edge).
- `book-title` test id moves onto the title span.
