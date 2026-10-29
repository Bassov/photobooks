# onboarding-others

Tag: feature
Milestone: backlog (held 2026-10-30; target P5)
Title: first run for other users

## Scope

- [ ] Start screen explaining the flow, sample book, helpful empty states
- **Browser check:** a fresh browser profile reaches a first laid-out spread without guidance.
- **Kit-first:** yes. Held in `docs/backlog/` (Designer call B1, 2026-10-30) until its kit page lands; then the Owner re-adds it with `pnpm roadmap add <slug> --after <X>` and the Reviewer fills in Kit components / Demo / Musts.
- **Kit components:** none, **kit-first**: Designer adds the kit page (`onboarding for other users`) before this item can be built; then the Reviewer fills in Kit components / Demo / Musts
- **Demo:** none yet (kit-first; Designer drafts flows first)
- **Musts:** a new user reaches a laid-out spread without help
- **Hard nos:** no UI before the kit flow
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-library-books
- **UI kit:** none (no matching component); kit-first
