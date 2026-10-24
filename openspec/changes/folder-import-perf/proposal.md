## Proposal

Roadmap: none (redesign prep, owner-approved off-roadmap). Batched folder import + prioritized post-reload re-scan so 2k–4k folders never freeze the UI.

### Scope out

- UI-kit restyle; multi-folder / per-file import; other redesign PRs
- Weakening LoAF / handler / INP budgets

### Delta / Risk

- UI: empty + happy `import-progress` + reload re-scan; no page H/V scroll (filmstrip scrollport).
- Security: photo-root FSA stays `read`; handles off domain API; idle re-scan cancellable, no permission escalation.
