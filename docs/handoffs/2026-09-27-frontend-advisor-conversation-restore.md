# Restore the conversation-first Advisor on navy

- **Date:** 2026-09-27
- **Author:** Codex, working with @AK1F5
- **Team:** frontend
- **Status:** done locally; not committed, pushed, or deployed
- **PR / issue:** Related draft #42; no remote update
- **Branch:** `feat/advisor-companion`
- **Follows:** [Ownership and Advisor](2026-09-27-frontend-scout-ownership-advisor.md), [Shared voice](2026-09-27-frontend-scout-shared-voice.md)

## What changed

- Restored the user's reference layout: a wide conversation on the left and investing context on the right, while retaining the dark blue background and Scout. Advisor opens to chat; a symbol deep link still opens Research unless a question/chat handoff is requested.
- Returned clear history to the page header. Replies have a left accent rule, larger type and more reading space. The educational disclaimer is visible below the composer.
- Kept ownership, risk and research as secondary views. Tool discussions open the main conversation and retain selected evidence; returning preserves the tool state and shared draft. Voice, evidence receipts and shared chat remain on their existing providers.
- Added editable starter questions and exposed the companion's existing simpler/example follow-ups in full Advisor. Restored the context-card subtitle. Context starts collapsed above the conversation on mobile.
- Updated existing browser checks for default chat, editable prompts, draft persistence and the visible context panel; added a phone composer/navigation clearance assertion.

## How to run / verify it

```bash
npm run lint -w frontend
npm run typecheck -w frontend
npm test -w frontend
npm run build -w frontend
npm run dev -w frontend -- --host 0.0.0.0 --port 5176 --strictPort
# In a separate shell with environment variables available to Node:
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout-ownership -w frontend
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout-workspace -w frontend
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout-voice -w frontend
PLAYWRIGHT_CHROMIUM_EXECUTABLE='/path/to/chrome' CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:browser -w frontend
```

Lint, typecheck, all 88 frontend unit tests and production build passed. Ownership, workspace, shared voice and full-site browser suites passed with synthetic API data. Desktop and 320px screenshots reviewed. The production build retains the existing >500 kB bundle warning. Backend behavior was not changed or revalidated live.

## Decisions & why

- The user's screenshot overrides the previous tool-first direction. Keep existing tools reachable without making a beginner discover how to open chat.
- Reuse SamsungOne and existing navy/yellow colors. Favor the reference's open reading area over another nested chat card.
- Prompts fill and focus the composer; users can edit them before sending. No question is automatically sent on arrival.
- Leave selected tool components mounted while their conversation is visible, so a return does not discard scenario controls or ownership disclosures.
- Preserve unrelated, extensive pre-existing local work. No commits, pushes, deployment or PR changes were made.

## Gotchas

- Context disclosure initially follows viewport width, then respects the user's expanded/collapsed state. Resizing an already-open desktop card to a phone does not close it automatically.
- The mobile thread scrolls independently. Its height leaves space for the site's fixed bottom navigation on an initial 320×900 view; expanding context can require page scrolling.
- Sandbox commands/image viewing failed on the host mount configuration. Local commands used escalation; images were inspected from generated screenshot bytes. Windows Node does not inherit arbitrary WSL environment variables: the verification runs set `process.env.CLEARVEST_PREVIEW_URL` and browser options directly before requiring each script.
- Screenshots and test fixtures are in ignored `frontend/node_modules/.cache/clearvest-review/`. They are synthetic data, not evidence of live finance/model correctness.

## Next steps

1. Review `/advisor` with a real conversation, context editing, voice playback, and a phone keyboard. A local preview is available on port 5176 during this session.
2. Prioritize a connected beginner journey: a plain-language portfolio summary, one relevant concept, an interactive example, and a follow-up question. Existing lessons, quizzes, glossary, scenarios, company comparison and evidence receipts should be reused.
3. Make Scout's answers short by default, with deeper detail on demand, context-specific follow-ups and links into the relevant existing tool or lesson. Pair risk scores with explanations of their drivers and limitations.
4. Extend educational scenarios to fees/inflation and dollar consequences; label assumptions and source dates. Add comprehension checks and measure successful understanding rather than chat volume.
5. When remote work is explicitly authorized, include this handoff with the work, use `team:frontend`, require green `ci-ok`, and retain prior provider/deployment verification tasks.

## Open questions / blockers

No local implementation blocker. Live provider/model behavior and deployment remain outside this UI milestone. The user requested improvement ideas; the next-step product ideas are proposals, not implemented features. Relevant references: [CFPB effective financial education](https://www.consumerfinance.gov/data-research/research-reports/effective-financial-education-five-principles-and-how-use-them/) and [W3C clear words guidance](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p01-clear-words/).
