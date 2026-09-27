# ClearVest advisor companion — design proposal

- Date: 2026-09-26
- Branch: `feat/advisor-companion`, based on main after the SQS history-refresh merge.
- Stage: Scout page awareness, interactive portfolio lab, company briefs and source receipts are implemented locally, alongside navy glass and guarded inference. Deployment and live evaluation remain pending.
- User brief: a character peeks from the bottom-right on Home, Portfolio, Learn and Markets; clicking lifts it and opens contextual conversation. On Advisor, the character sits next to “Ask about your money.” It needs idle, attentive, thinking and finished states, stronger beginner explanations, and useful current economic/news context.

## Current implementation

The latest [ownership and Advisor redesign](scout-ownership-and-advisor.md) adds source-backed fund overlap and simplifies the page to What I own, Risk check and Research, with chat and supporting details opened on demand. It supersedes the earlier always-visible chat/context layout. See the [ownership handoff](../../handoffs/2026-09-27-frontend-scout-ownership-advisor.md) for verification and data limits.

Voice is now shared across Scout and Advisor, including spoken questions and Listen on typed answers. See [the voice flow](scout-voice.md) and [voice handoff](../../handoffs/2026-09-27-frontend-scout-shared-voice.md).

Read [Scout’s investor workspace](scout-investor-workspace.md) for the current feature set, architecture, judge demo and next priorities. It implements recommendations 1–3 from [the previous safety report](scout-guardrails-and-demo.md). The latest [handoff](../../handoffs/2026-09-26-frontend-scout-investor-workspace.md) contains verification and operational details.

Thinking eyes are static, opening moves down then up, and Advisor is a navy workbench. The popup keeps BETA and “A little clarity, whenever you need it.” on one line. Selection identifiers now reach the server; financial facts are loaded independently.

## Original design proposal (historical)

The proposal below records the initial design and possible future capabilities. Its proposed request fields, earlier motion/copy, and missing-feature assessment are historical; use the current implementation report above for shipped scope.

## Recommended direction

Build one persistent learning companion with two presentations: a compact page companion and the full Advisor workspace. One conversation, draft, pending request, voice controller and source system serve both. Preserve the light SamsungOne brokerage design and let the character provide personality.

**Selected mascot: Scout, the bird.** The user selected Scout. Its compact navy silhouette, white face, golden beak and curious head tilts define the companion. Keep the crest small and expressions calm.

[Scout concept sheet](scout-bird.png) was generated with the built-in `image_gen` tool. Its exact prompt is in [prompts.json](prompts.json). The sheet is a visual reference; do not reproduce its illustrative title strip or extra quotation marks.

Scout now uses a [four-pose body atlas](../../../frontend/public/images/scout/scout-body-poses.png) with independently animated pupils and eyelids. At rest he peeks with paws over the edge. Hover, keyboard focus or opening reveals more torso and transitions to listening with wings at his sides. A real pending request uses the wing-under-beak thinking pose; a new reply briefly raises a wing, then settles back to listening or peek. [Preview the motion study](scout-preview.html). Built-in image generation produced the aligned artwork; exact prompts are in [prompts.json](prompts.json).

`Scout.tsx` renders the rig, and `ScoutCompanion.tsx` mounts outside the keyed route outlet. Scout rests bottom right on Home, Portfolio, Markets, Learn and lesson routes, directly above mobile navigation. The outer launcher stays fixed while the body rises inside its clipped frame. Advisor retains its inline character. Both surfaces share messages, pending requests, retries and an in-memory draft.

The panel uses restrained translucent blue-gray glass with backdrop blur, a fine light border, simpler message bubbles and quieter controls. A green EXPERIMENTAL label sits beside Scout's name and accompanies the resting launcher. The subtitle is “Your moral support, whenever you need it.” on one line, including at 320px. Quiet motion and Minimize were removed at the user's request. The centered information icon reveals educational disclosure on hover or keyboard focus; Escape dismisses it, and touch can focus it. It is not a disclosure button.

Reduced motion remains controlled by device settings; ambient motion pauses in hidden tabs. The mobile panel uses the visual viewport to keep its composer above the keyboard. The backend still receives only the user's text, so the panel does not claim automatic screen awareness. These are registered raster body/wing poses with continuous eye movement and a rising body transform, not a full 3D rig.

## Interaction and visual plan

For the surrounding website, keep the existing six-color base: canvas `#F5F7FA`, white `#FFFFFF`, ink `#172B46`, cobalt `#2457C5`, rule `#DDE3EB`, secondary ink `#536176`. Use SamsungOne for all controls and replies. Keep content left aligned; use current border/radius tokens and overlay shadow only for the conversation panel.

Desktop: 112px character footprint, about 20px from the right viewport edge (88px on mobile). Crop transparent art padding in the SVG viewBox so the visible wings meet the resting edge. The entire visible character is a minimum 44px keyboard-accessible button. The panel opens above/left of it, around 416px wide with a bounded scroll area; screen size governs its maximum width and height.

```text
Current page remains usable

┌────────────────────────────────┐
│ Using Portfolio · VOO      ×    │
│                                │
│ Ask about what you're viewing. │
│ [Why this risk score?]         │
│ [How does VOO fit?]            │
│                                │
│ [Ask a question…          ↑]   │
└────────────────────────────────┘
              (peeking companion)
```

Advisor: a small inline character sits immediately beside the existing title, aligned with the heading group. Keep the supplied title as the page's visual anchor. The inline character focuses the composer; do not also show a floating character or a second chat panel on this route. The full thread supports deeper answers, citations, conversation history and context inspection.

```text
(companion)  Ask about your money
────────────────────────────────────────────────
Conversation                         Context used
Answers, sources, next question      Current page / portfolio / dates
Composer + existing voice controls
```

Mobile: place the launcher above the fixed navigation and device safe area. Opening uses a nonmodal panel sized to the visual viewport so the keyboard cannot hide the composer. Escape and close restore focus to the launcher; the page remains keyboard-accessible. A future modal presentation would need focus trapping. Test at 320px and with zoom. Reserve enough layout space that the closed launcher never covers a required control.

### Motion states

| State | Character | UI behavior |
|---|---|---|
| Idle | Occasional tiny pupil glance and blink; long still intervals | Never initiates an AI request or pops open a reply |
| Hover/focus | Body rises to reveal the chest, wings at its sides | Show a clear “Ask about this page” accessible label |
| Open | About 18px of additional torso is revealed within a fixed frame | Panel opens in roughly 200–280ms; focus composer |
| Typing | Attentive eyes, largely still | Context and suggestions remain readable |
| Thinking | Small upward glance and slow head/hand motion | Honest status: preparing answer, or a real server-reported retrieval stage |
| Reply ready | One small nod, then settle | Show answer and sources; no repeating celebration |
| Unavailable | Neutral expression | Retain draft and offer retry; never imply missing data was understood |
| Voice recording/playback | Existing mic/speech state drives expression | Reuse existing explicit mic permission, stop and playback controls |

Do not fabricate progress percentages, searches, checks or internal reasoning. Glances are cosmetic; no gaze tracking, cursor surveillance or screenshot capture is implied. Pause idle motion after a short sequence, when the document is hidden, and whenever reduced motion is preferred. Follow device reduced-motion preferences; do not add local Quiet motion or Minimize controls. Do not animate gain/loss excitement or push activity notifications.

The live implementation registers four body/wing poses to a common head position. Poses dissolve while the body translates vertically and pupils move independently. Further continuous wing articulation would require separate wing layers.

## What “understands my screen” means

Read the application's explicit state. Start with route, selected symbol, displayed range, lesson, and active panel. This is more precise than analyzing a screenshot of data the app already owns.

| Surface | Useful context | Example invitation |
|---|---|---|
| Home | First-time/returning state and next lesson; profile/portfolio only when enabled | “Where should I start?” |
| Portfolio | Current researched symbol/range, holdings snapshot, risk inputs and score | “What is driving my risk score?” |
| Learn, including lesson routes | Lesson ID, topic, current card or glossary term | “Explain this with an example.” |
| Markets | Research symbol, submitted comparison set, displayed metric or news item | “How are these companies different?” |
| Advisor | Thread and last explicitly carried page context, clearly labeled | “Continue discussing VOO.” |

Context priority: an explicit “Explain this” action > focused panel > selected entity > route-level context. Draft comparison tickers must not be confused with the comparison actually displayed. User cursor position alone does not select a security. A selected chart observation needs an explicit supported context event; chart range alone does not describe the point being inspected.

Provide a small disclosure such as “Using Portfolio · VOO · risk snapshot,” expandable to dates/sources. Users can turn page context off, independently of opting into personal portfolio context. The app must describe exactly what is included. Hidden balances should remain masked in the visible companion and should not be sent to public search. Do not send passwords, access tokens, raw DOM, whole localStorage, or unrelated page contents.

Proposed request shape (not implemented):

```json
{
  "message": "How does this fit my portfolio?",
  "requestId": "client-generated-id",
  "context": {
    "version": 1,
    "route": "portfolio",
    "symbol": "VOO",
    "range": "1y",
    "focus": "risk",
    "revision": "page-context-revision"
  },
  "includePageContext": true,
  "includePortfolioContext": true,
  "detail": "brief"
}
```

These fields are bounded navigation hints, not trusted financial facts or authorization. The server validates allowed routes, IDs, ranges and size, then loads authorized holdings and verified market snapshots itself. Do not let a request supply a different user's ID for a context tool. Production personal-account use still requires replacing the existing demo `X-User-Id` identity with authentication.

Freeze context at send time. Store its revision with the request and reply. A reply about VOO stays about VOO if the user navigates to AAPL while it is loading. Retrying reuses the original request context; it does not silently substitute a new page. Unregister page state on unmount so old selections do not leak into the next route. Carry context into Advisor only through an explicit labeled transition.

## Make the assistant more useful before choosing a bigger model

Current code already shares a `ChatProvider` across routes and builds server context from profile, holdings, deterministic risk, FRED cache and recent chat. It currently sends only `{message}` from the frontend. Important gaps:

- No current route, researched security, chart range, lesson or selected metric reaches the model.
- The prompt forbids naming any ticker outside the user's holdings, blocking ordinary Markets research.
- The text response has a blanket roughly-120-word instruction and 450-token cap. That is useful for a small panel but can truncate an explanation or sourced comparison.
- News exists in the market API but is not attached to advisor context. The news cache holds publisher headlines/URLs/timestamps, not the full article text.
- The Bedrock adapter reads only the first text block and discards structured citations/tool-use blocks.
- Voice has a tighter deadline and shorter response allowance; it must not inherit a slow research loop accidentally.

### Grounded context and response contract

Build a shared server context assembler used by both text and voice. Reuse trusted market read models instead of importing MarketFn route handlers into the advisor or making browser-controlled tool calls. Read only the relevant subset of holdings/research so every question does not ship the whole account and all news.

Retain deterministic calculations for allocation, risk and scenario arithmetic. Identify the current risk score as ClearVest's heuristic; do not present it as a forecast or probability of loss. Allow educational discussion of researched or user-mentioned securities once grounded in supported data; preserve the distinction between explaining tradeoffs and prescribing trades.

Return structured `sources`, `contextUsed`, `dataAsOf`, and freshness/missing-data notices alongside the answer. Validate source IDs against retrieved evidence and allow only safe navigational actions from an application-owned route registry. Distinguish observed facts, interpretations, and unknowns. A headline about an event does not prove why a stock price moved.

Use brief replies by default (roughly 80–160 words as a product target) with “Explain more” or a lesson link. Full Advisor can expand within a separately budgeted response. Voice stays short and reads prose, with citations available in the transcript. Typed and voice input must share one in-flight guard and the same conversation/context lifecycle.

### Economic data and news

1. Use the existing FRED observations and market snapshots for available economic figures and securities. Preserve observation date separately from retrieval time. Existing history can be a day old; never label it real-time.
2. Reuse relevant FMP headlines with publisher, publication time and source link. Deduplicate stories. Describe these as headlines unless the actual article content is fetched by an authorized retrieval path.
3. For questions requiring newer evidence, evaluate bounded public-web grounding. Prioritize primary sources such as central-bank releases, statistical agencies and company filings for factual figures, with publisher reporting for context. Do not infer a latest event from the model's training knowledge.
4. Isolate public retrieval from private account context. A research query should contain the public topic, symbol and date range, not balances or personal goals; combine the returned evidence with private context only in the answer step. Treat retrieved text as untrusted data, never instructions.
5. When sources are stale, unavailable or contradictory, state that and still explain the general concept. No fabricated headlines or implied live monitoring. Refresh/prepare public context once for many users; the existing SQS worker covers history only, so macro/news refresh jobs would be explicit future additions.

### Model and transport choice

Keep current Nova 2 Lite as the measurable baseline. AWS documents optional extended thinking and built-in web grounding for that model; our integration enables neither. Prototype bounded reasoning for complex comparisons, normal reasoning for definitions, and benchmark against an available Bedrock Claude Sonnet candidate. Select by grounded correctness, beginner clarity, calibration, latency and cost on ClearVest tasks rather than model size alone. Do not turn maximum reasoning on globally.

Enabling grounding requires tool configuration, scoped `bedrock:InvokeTool` permission, parsing all response blocks, retaining/displaying citations, and accounting for additional cost/latency. A model switch also needs an updated IAM model allowlist and model-specific inference settings. Confirm availability/entitlement in the deployment account; this exploration made no live model calls.

The existing API is API Gateway HTTP API with a 29-second advisor Lambda deadline. Start phase one with bounded cached context and buffered replies plus honest local loading states. Longer research should use a separately budgeted asynchronous job or an intentionally designed streaming endpoint. Native Bedrock `ConverseStream` alone does not make the current browser endpoint stream: AWS documents API Gateway response streaming for REST APIs. Prototype a small dedicated REST streaming path if streaming is chosen, including authentication, abort handling, disconnect behavior and idle/total deadlines. Do not raise Lambda timeouts and assume the current HTTP API will keep waiting.

## Integration locations and delivery slices

| Slice | Concrete work | Acceptance criteria |
|---|---|---|
| 1. Companion interaction | Add `CompanionProvider`, layered mascot, launcher/panel and inline Advisor presentation. Mount beside the routed outlet in `AppShell`, outside the pathname-keyed `main`. Reuse `ChatProvider`; keep draft/pending/voice state in stable shared providers. | Correct placement on five surfaces; smooth open/close; one thread; no duplicate launcher; keyboard/reduced-motion/mobile behavior |
| 2. Page awareness | Add typed context registration to Portfolio research, Markets workspace/comparisons, Learn cards and Home. Extend API contract/server validation and per-turn context metadata. | “This stock” resolves to the displayed symbol; navigating during a reply or retry never changes its reference; no profile required for basic learning |
| 3. Grounded answers | Move relevant market snapshot access into shared server helpers, attach dated macro/news evidence, revise restrictive prompt rules, return/render source metadata. | Sourced claims, correct units/holdings, clear missing/stale states, explicit educational discussion of non-held tickers |
| 4. Model/research evaluation | Add a fixed evaluation set, compare baseline/configurations/candidate model, prototype public grounding and appropriate transport. | Measured quality/latency/cost improvement; no unsupported newest-news claims or unbounded tool loop |
| 5. Production readiness | Authenticated user context, retention/deletion behavior, cost caps, observability, feature flag/rollback, real-provider tests | Verified isolation and recoverability before real personal-account rollout |

With Scout selected, next implement the interaction against existing chat with a feature flag, then page context and grounded answers. This keeps the UI usable while intelligence upgrades are validated. No fine-tuning or vector database is needed just to make the companion understand its current page. Add document retrieval only if a real corpus and retrieval evaluation justify it.

## Evaluation and critique

Use at least 30 scripted scenarios across Home/Portfolio/Learn/Markets/Advisor. Include no account, missing risk data, stale snapshots, unknown symbol, the user comparing securities they do not own, “why did this fall today?” with insufficient evidence, changing pages during a request, voice/text overlap, forged context, and an article containing hostile instructions.

Measure context-selection accuracy, numerical correctness, source support and freshness disclosure, clarity for beginners, latency to useful output, completion rate and cost per answered question. Validate any proposed numeric success thresholds against the baseline; no performance numbers are established by this design exercise. Add human review by novice users and someone qualified to check the financial explanations.

Motion review: Scout preserves the softly shaded face and animates independent eye layers. Verify small-size legibility and preserve its compact silhouette as the floating presentation is added. Avoid extra badges, a glossy AI orb, speech bubbles that interrupt reading, and duplicated chat surfaces. The small invitation should feel optional and dependable.

## Sources verified for this proposal

- [Nova 2 Lite web grounding](https://docs.aws.amazon.com/nova/latest/nova2-userguide/web-grounding.html): setup, citation preservation, permissions, regional constraints and additional cost.
- [Nova 2 extended thinking](https://docs.aws.amazon.com/nova/latest/nova2-userguide/extended-thinking.html): selective reasoning configuration and model-specific constraints.
- [Bedrock ConverseStream](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html): model-side streaming API.
- [API Gateway response transfer mode](https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode.html): REST API response-streaming support.
- [Bedrock Anthropic model catalog](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards-anthropic.html): candidate models; account access and task quality still need testing.

## Decisions still open

- How much optional idle motion feels right in the actual app; test the quiet default first.
- Model/research budget and desired latency for “explain this” versus deeper research.
- Whether voice appears in the compact panel at launch or follows after shared voice state is consolidated.


## Guardrails and judge demo milestone

Scout now uses popup-only BETA, navy/yellow glass and an opening scale reaction.
The subtitle is “A little clarity, whenever you need it.” on one line.
See [the implementation assessment and demo plan](scout-guardrails-and-demo.md)
for finance/privacy guardrails, standalone portfolio grounding, privacy scope,
deployment requirements and the highest-impact next improvements. This latest
milestone supersedes the earlier experimental badges and moral-support subtitle.
AWS deployment and live classifier evaluation remain pending.
