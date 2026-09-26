# Dark branded footer

- **Date:** 2026-09-26
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done (local implementation)
- **PR / issue:** Not opened; include in the frontend PR with `team:frontend`.
- **Branch:** `feat/frontend`
- **Follows:** [Inclusive investing experience](2026-09-26-frontend-inclusive-investing-experience.md)

## What changed

- Added a full-width dark navy footer with the ClearVest mark and “Clarity for every investor.” tagline.
- Preserved educational disclosures and TradingView attribution in a quieter lower row.
- Added responsive stacking, mobile safe-area clearance and contrasting link focus outlines.
- Updated DESIGN.md and the design-direction notes to document the branding treatment.

## How to run / verify it

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

Open `/learn` or `/portfolio` and scroll to the bottom. Check desktop and 320px mobile widths,
footer links and visibility above the mobile tab bar. No data or API behavior changed.

## Decisions & why

- Reused the existing navy/white tokens to fit ClearVest’s identity and the user’s dark-footer reference.
- Kept the main application light; the footer is a deliberate branded surface.
- Used an inclusive tagline without inventing social accounts, policy pages or trademark registration.

## Gotchas

- AppShell owns this shared footer; standalone onboarding remains outside that shell.
- Keep the existing TradingView notice/link when editing footer copy.
- Other uncommitted frontend and repo edits predate this task; preserve them when preparing the PR.

## Next steps

1. Review the local footer on desktop and mobile.
2. Include the handoff in the frontend PR, label `team:frontend`, and require green `ci-ok` before merging.

## Open questions / blockers

None for the footer. Deployment and PR assembly remain separate.
