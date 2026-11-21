# design-r39-chevron-prod

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r39-chevron-prod
Status: done

## Scope

- [ ] Designer parity frame-context-menu p2 Must M148 (round 39): inspector section chevrons (`.pb-disclosure__chevron`, `src/ui/Disclosure.css`) paint the kit `text-muted-foreground/70` — `color-mix(in oklab, var(--muted-foreground) 70%, transparent)` — instead of solid `var(--muted-foreground)`; hover / expanded states unchanged. Prod-only fix; no other `src` CSS chevron rule copies the solid colour.
- [ ] e2e `e2e/design-r10-inspectors.spec.ts` (M60 test) checks paint on a clipped screenshot of an open and a closed chevron: darkest red pixel on the rgb(225) panel 160 ±6 for the open ▾ (was 132), 151 ±6 for the closed ›.
- **Browser check:** select a filled frame; the Photo inspector section chevrons read lighter (kit /70 ink), open and closed.
