# Scout answers without a profile; footer note instead

- **Date:** 2026-09-27
- **Author:** @wakeensito
- **Team:** ai
- **Follows:** 2026-09-27-ai-guardrails-off-for-demo.md

## What changed
- `src/layer/clearvest/advisor.py`: the system prompt no longer lets Scout ask for age, time horizon or goals; it gives a general beginner answer instead.
- When the profile has no age or horizon, chat replies (not voice) end with `PROFILE_NOTE`: "For more personalized guidance, add your age, time horizon and goals in your profile."
- The note is added to the response only, never stored in chat history, so the model doesn't learn to repeat it.
- Profile fields are read with `.get()`, so a partial profile can't crash the prompt.

## Why
Scout stalled mid-demo by asking for the user's age before answering.

## Next steps
1. Consider linking the note to the profile screen in the frontend.

## Gotchas
- The chat renderer only supports **bold**, so the note is plain text.
