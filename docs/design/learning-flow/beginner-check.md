# Check whether beginners can explain what they learned

This is a runnable usability-study protocol, not a claim that a study has already happened. Automated tests verify the flow and scoring; only participant sessions can establish whether it helps people learn.

## Scope

Scout now connects a screened answer to one existing lesson, a short multiple-choice question, and an optional written explanation. The written explanation is compared by the learner with the existing lesson's key ideas. It is not graded by a model or keyword matching. Original writing is neither sent to the API nor saved in browser storage.

The Learn page records the first attempt per question and the latest self-review choice. Retrying after seeing the answer does not improve the first-attempt score. Practice does not complete a lesson. Results are scoped to the demo user and stay in this browser; blocked storage falls back to memory until reload. The reset action clears practice independently of completed lessons.

## Participants and setup

Use five people who describe themselves as new to investing. Five sessions are a discovery pass, not statistical proof. Recruit separately; no invitations have been sent. Use synthetic portfolios, not participants' accounts. Test at least one phone and one slower device/network. Explain the session and obtain consent before taking notes. Avoid collecting personal financial information.

## Tasks (15 minutes per participant)

1. Before showing the answer, ask: “If someone owns three funds, are they necessarily well diversified? Explain your reasoning.” Record the explanation verbatim with consent, or use anonymous facilitator notes. Do not correct it yet.
2. Have the participant ask Scout about diversification and fund overlap. Let them find Keep learning without pointing it out. Record whether they discover the lesson/check and any confusing language.
3. Let them take the quick check, write an explanation in their own words, compare it with the lesson and choose their self-review. Note whether they revise an incorrect belief. Do not treat their confidence as evidence of correctness.
4. Ask them to open the lesson and return to Scout. Verify they can find their conversation and unfinished chat draft.
5. Close the app. Give a new scenario: “Two funds both put a large share in the same company. What could happen if that company falls? Can diversification prevent every loss?” Ask for an explanation without multiple-choice options.
6. If participants agree to a follow-up, ask a similar question the next day with different fund/company names. Measure recall rather than recognition of the original quiz.

## Facilitator rubric (human scored, 0–4)

Award one point for each accurately explained idea:

- Owning several funds does not automatically mean holding different underlying investments.
- Shared underlying holdings can make funds fall together when that holding declines.
- Spreading investments can reduce the effect of a single loss.
- Diversification cannot eliminate all losses or guarantee a return.

Record pre/post/delayed scores separately. Keep quiz first-attempt correctness, self-review confidence and human-scored explanations separate. The app's saved self-review is not a human or AI assessment.

## What to learn from the sessions

- Discovery: can people find a relevant learning step without help?
- Comprehension: does the explanation improve on a novel scenario, not just on the shown question?
- Calibration: does confidence match what the person can actually explain?
- Continuity: can they return from a lesson without losing their question?
- Accessibility: can they finish using a phone and keyboard, read the controls, and understand loading/errors?

For the first five sessions, investigate every persistent misconception. A useful initial product target is four participants independently finding the learning step and explaining at least three rubric points after using it. This is a proposed target, not an observed result or statistical threshold. If people only repeat the answer wording, revise the example or add a different transfer scenario before adding more content.

## Implementation limits

Recommendations use allowlisted lesson links from response receipts, then curated concept matching. Only answers whose safety status is `passed` receive recommendations. Unknown, refused, unavailable and unrelated answers do not. This is a deterministic relevance aid, not a personalized mastery model. Existing lesson content is reused; this change does not revalidate financial facts or model output.
