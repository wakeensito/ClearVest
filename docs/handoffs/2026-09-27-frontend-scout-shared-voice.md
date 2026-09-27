# Shared ElevenLabs voice in Scout and Advisor

- **Date:** 2026-09-27
- **Author:** Codex, working with @AK1F5
- **Team:** frontend (with TTS normalization changes)
- **Status:** done locally; deployment/live verification pending
- **PR / issue:** Related draft #42; no remote update
- **Branch:** `feat/advisor-companion`
- **Follows:** [Scout investor workspace](2026-09-26-frontend-scout-investor-workspace.md), [Advisor voice button](2026-09-26-frontend-voice-button.md), [voice backend](2026-09-26-ai-advisor-voice.md)

## What changed

- Both Scout and Advisor now use one recording/playback controller above the router. Each has a microphone, recording feedback, cancellation, pause/resume/stop and per-answer Listen controls, including typed answers.
- Voice captures the initiating page/tool context and respects Scout's sharing opt-out. Submitted questions, source receipts and playback survive route changes. Typed drafts remain intact, and one shared request reservation prevents overlapping voice/text turns.
- Closing an unsent recording stops its tracks without an upload. Late permission grants are cleaned up. Explicit popup closure suppresses late audio; inference already submitted may still complete into the shared thread. TTS/autoplay errors preserve the text answer and allow manual retry.
- Speech strips visual citation markers and Markdown link destinations; normalized empty speech is rejected. The existing server output cap remains. Latest audio replay uses an expiring memory-only URL cache.
- Added [voice behavior/architecture notes](../design/advisor-companion/scout-voice.md) and a synthetic browser integration suite, `npm run test:scout-voice -w frontend`.

## How to run / verify it

```bash
npm run lint -w frontend
npm run typecheck -w frontend
npm test -w frontend
npm run build -w frontend
python -m pytest -q tests/voice tests/layer/test_scout_context.py
ruff check .
# With Vite running against the local API base used by the fixture suites:
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout-voice -w frontend
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout -w frontend
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout-safety -w frontend
PLAYWRIGHT_CHANNEL=chrome CLEARVEST_PREVIEW_URL=http://127.0.0.1:5176 npm run test:scout-workspace -w frontend
```

Frontend lint/typecheck/build and all 88 frontend tests passed. 32 relevant backend tests passed; after the final empty-speech guard, all 15 voice tests passed again. Ruff passed. Shared-voice and existing Scout motion, safety and workspace browser checks passed. Desktop/320px screenshots were reviewed. The existing frontend >500 kB bundle warning remains. The browser suite uses a synthetic microphone, mocked audio playback and API fixtures; it never uploads real speech or contacts ElevenLabs/Nova.

## Decisions & why

- `VoiceProvider` lives inside `ChatProvider` and outside `RouterProvider`; page unmounts cannot lose a submitted result. `useVoiceTurn` is now a surface binding with an owner ID, context and a microphone-denied focus callback.
- Recordings reserve the shared chat from permission request through inference. Unmounting/closing a recording surface cancels only its unsent capture; submitted inference survives and is not retried automatically.
- ElevenLabs performs STT/TTS; the existing Nova advisor remains the only reasoning path with the same finance/privacy checks. No separate ElevenLabs agent or second AI conversation was introduced.
- Automatic speech follows voice questions. Typed questions stay silent until Listen is pressed. The latest replay reuses a URL only before its reported expiry, with a safety margin; it never extends expiry merely by replaying.
- Citation numbers remain visual, and TTS retains the previous output-length limit. Text answers remain usable when microphone or playback support fails.
- Follow the user's standing instruction: nothing pushed or deployed. Earlier local Scout/guardrails changes remain uncommitted and preserved.

## Gotchas

- Recording requires HTTPS or localhost and explicit browser microphone permission. Voice controls support tap-to-record, not live streaming, automatic turn detection, wake words or spoken app navigation commands.
- A transcription is visible after `/voice/turn` finishes; there is no partial transcript event. The existing 60-second recording cap and 10 MB server upload cap remain.
- Closing Scout after submission cannot undo a provider call or delete its upload; it stops current/future audio playback. Existing S3/STT retention policies are unchanged.
- Original `useVoiceTurn` owned its resources per Advisor mount. Do not instantiate separate controllers for Scout and Advisor again, or shared playback/turn protection will break.
- Do not disable the recording button merely because the shared conversation is busy: the square must remain available to stop and submit. Upload/thinking/permission/TTS preparation have their own disabled states and status text.
- WSL sandbox mount failures required approved local-command escalation. Windows Node/Chrome ran browser checks; Python tools are in `/tmp/clearvest-venv`. An existing Vite at port 5176 was reused. The attempted duplicate server correctly failed its strict-port check.

## Next steps

1. Review the local controls in Scout and Advisor, including a voice question followed by Listen on a typed answer.
2. When deployment is authorized, deploy the updated frontend/voice code together with the pending guardrails changes and verify actual ElevenLabs STT/TTS and Nova behavior on the target HTTPS origin.
3. Test Safari/iOS permissions and autoplay; measure time to transcript, text answer and first audio before considering streaming.
4. Push/update draft #42 only when explicitly requested, use the appropriate `team:*` labels, and require green `ci-ok` before merge.

## Open questions / blockers

No local implementation blocker. Live ElevenLabs quality/latency, deployment credentials/model access and Safari/iOS playback remain unverified for this milestone. This work does not authorize a push or deployment.
