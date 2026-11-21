# design-r37-dialog-title-prod

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r37-dialog-title-prod
Status: done

## Scope

- [x] Designer parity M144 (Round 37, walkthrough-ux-review p4): the Print, Export site and Publish dialog titles (shared `.export-site-dialog .pb-dialog-title`) track −0.005em (−0.105px at 21px) like the kit `.heading` title, not `normal`; text widths within 0.3 px of the kit (Print 47.89, Export site 106.22, "Publish to your site" 186.55). No other dialog title changes tracking; base `.pb-dialog-title` unchanged.
- **Browser check:** e2e `design-r37-dialog-title.spec.ts` reads the computed `letter-spacing` and the title text-run width on each open dialog.
