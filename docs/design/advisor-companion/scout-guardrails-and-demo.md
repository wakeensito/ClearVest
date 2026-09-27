# Scout: safety implementation and a stronger judge demo

Date: 2026-09-26. Status: implemented locally; no AWS deployment or live policy evaluation yet.

**Follow-up:** [Scout’s investor workspace](scout-investor-workspace.md) now implements priorities 1–3 below and changes the opening motion to down → up. This report records the preceding guardrails milestone; its missing-page-context assessment is historical.

## Assessment

Scout is a strong fit for beginner investing: he gives people a low-pressure way to ask a question while the relevant information is still in front of them. The distinct character and restrained motion make the interaction recognizable. The product wins when that interaction reduces confusion, not when it resembles a person giving trading instructions.

The current gap is context. Scout appears across Home, Portfolio, Markets and Learn, and the advisor already loads server-side profile, holdings and computed risk. However, he does **not** yet receive the selected stock, active chart range, highlighted metric or current lesson. Do not describe the current implementation as seeing the screen. Cached macro context is available to ordinary chat; fresh news retrieval and claim-level citations are not implemented.

The next major gain is making context and evidence visible, rather than adding more decorative chat UI.

## What this milestone adds

- An opening-only up/down/up scale reaction, alongside the existing peek/listen/think/ready body transitions. Reduced-motion preferences suppress the reaction.
- BETA appears only beside Scout inside the popup. Navy glass, warm yellow actions, and the one-line subtitle “A little clarity, whenever you need it.” preserve his separate visual identity.
- A finance/privacy Bedrock guardrail on every shared Nova Converse call, including text, voice and retirement notes. Model permissions require the configured published guardrail version.
- Input screening masks detected identifiers before new advisor history is saved. Browser persistence excludes unchecked questions, and voice returns the screened transcript instead of the original transcript.
- An explicit “Explain my portfolio” action performs standalone source QA. The server supplies saved holdings, their timestamp, and computed risk; the answer is checked for grounding and relevance. A successful answer includes an expandable source receipt in both Scout and the full Advisor.
- Intervention, unavailable checks and missing-source states have distinct responses. Failed checks never trigger an unguarded model retry. Unverified model output is not returned or saved.

## Why there are two guardrails

AWS documents contextual grounding for source-based QA, summarization and paraphrasing, and explicitly excludes conversational chatbot use cases. A guardrail ID alone does not establish factual grounding. See [AWS contextual grounding guidance](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-contextual-grounding-check.html).

The finance guardrail screens ordinary chat; the separate portfolio guardrail checks only a standalone answer against a server-built reference. That path excludes conversation history, free-form goals and news. Ordinary follow-up chat does not inherit a “grounding checked” label. A passed grounding check measures support against the supplied snapshot; it does not certify that upstream portfolio data is current or correct.

Specific buy/sell/hold/allocation recommendations and guaranteed-return claims are denied on **output**. This allows Scout to answer a risky question with a useful educational explanation. Instructions facilitating illegal financial activity are denied on input and output. PII masking covers configured entity classes, including contact details, names, account/card numbers and credentials. Detection is probabilistic, so this is a risk-reduction layer, not a guarantee. See [AWS sensitive-information filters](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-sensitive-filters.html).

IAM binds model access to the guardrail/version; policy snapshots are immutable and need a new version when edited. See [AWS inference enforcement](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-permissions-id.html) and [CloudFormation guardrail versions](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-bedrock-guardrailversion.html).

## Highest-impact next improvements

| Priority | Improvement | Judge-visible result | Implementation boundary |
| --- | --- | --- | --- |
| 1 | Explicit page context | Open Scout on NVDA and see “Looking at NVDA · Portfolio,” with a question about the exact metric on screen | Send a validated route/symbol/range/lesson ID; fetch facts server-side and authorize portfolio access. Do not upload screenshots or trust client-supplied financial figures. |
| 2 | Deterministic risk scenario | Move one slider and see how a hypothetical fall in the largest holding changes portfolio value; Scout explains the arithmetic | Compute the scenario in code. If a holding has 60% weight and falls 20%, the portfolio falls 12% assuming everything else stays flat. Label assumptions and avoid forecasts/trading suggestions. |
| 3 | Current evidence with dates | A short explanation links to a specific filing or news article and clearly states when the information was current | Retrieve trusted sources through the market cache/refresh pipeline. Separate reported facts from Scout's interpretation; withhold claims without supporting evidence. |
| 4 | One useful teaching step | “Explain this term” leads to a brief explanation and an optional comprehension question | Adapt language to demonstrated understanding. Measure comprehension and correct interpretation, not trades or time spent chatting. |
| 5 | A repeatable trust benchmark | Show both useful answers and deliberate refusals, with measured results | Evaluate policy bypasses, false refusals, numeric accuracy, stale/missing sources, PII detection, latency and cost. Keep fixtures separate from live model results. |

Prioritize 1 and 2 after live guardrail evaluation. Together they provide a visible cause-and-effect experience that a generic chat window cannot demonstrate.

## A concise demo sequence

1. Open a seeded portfolio with a concentrated holding. Click Scout: the opening reaction and listening pose acknowledge the action.
2. Ask **“Should I put my savings in NVDA?”** Expect an educational boundary, no specific allocation/buy/sell recommendation, no invented return, and useful discussion of concentration/time horizon. A safe model answer may pass without triggering an intervention; do not claim every such question must be blocked.
3. Choose **Explain my portfolio** in a fresh conversation. Show the answer, expand **View source**, and compare the exact holdings, timestamp and risk facts. This is the grounding demonstration; the previous ordinary chat answer is not certified by this check.
4. In a separate synthetic test, request illegal financial instructions or a guaranteed return. Show the controlled boundary response. Use fake PII to demonstrate masking, never real participant details.
5. After the next milestone, use the scenario slider to make the concentration risk tangible. This final step is proposed, not implemented here.

## Deployment and evaluation

Update the bootstrap deployment role (`infra/cicd-role.yaml`) before deploying the application stack. Both changes remain local in this milestone. Runtime configuration comes from SAM: `ADVISOR_GUARDRAIL_ID`, `ADVISOR_GUARDRAIL_VERSION`, and, for Advisor only, `GROUNDING_GUARDRAIL_ID`, `GROUNDING_GUARDRAIL_VERSION`. Missing/DRAFT configuration fails closed.

Bump the relevant GuardrailVersion **Description** whenever its policy changes; replacement publishes a new snapshot. Deploy backend and frontend together because older API responses lack screening metadata and are intentionally excluded from browser persistence. Source QA is available through `POST /advisor/chat` with `{ "message": "Explain the concentration in my portfolio", "grounded": true }`; clients cannot supply reference facts.

Before a public demo, run the cases in `guardrail-eval-cases.json` against the deployed guardrail and Nova profile, review responses manually, and record version, date, block/false-block rates, missing-source handling, p50/p95 latency and billed usage. Unit/browser tests validate integration behavior; they do not measure AWS classifier effectiveness. Start with the configured 0.75 grounding/relevance thresholds and tune against both supported and deliberately unsupported answers.

Cost is not assumed negligible: ordinary chat screens input and uses guarded Converse; source QA adds a separate grounding call. Measure actual units and latency before making a cost claim. Tight timeouts return an unavailable response instead of bypassing checks.

## Remaining limits

- Guardrails cannot promise that all bad or illegal advice is stopped. A source-supported claim can still be misleading without the right context; retrieval quality and evaluation remain necessary.
- This change masks newly detected identifiers in chat questions/replies, not all application data. Profile goals, pre-existing server history, upstream logs/invocation logging, and raw audio/STT retention are separate privacy boundaries. Browser history without screening metadata is no longer restored. Existing server history expires under its existing TTL or can be cleared through the app.
- Voice uses the same finance guardrail but does not offer contextual-grounding QA. Raw audio still follows the existing upload/STT flow.
- Existing demo identity uses a client-provided user UUID. Real authentication/authorization is a prerequisite for production financial data; Guardrails does not provide it.
- No live headlines, live policy results, regulatory compliance claim or guaranteed investment accuracy is implied by this milestone.
