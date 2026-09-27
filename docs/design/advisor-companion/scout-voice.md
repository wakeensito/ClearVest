# One voice conversation across Scout and Advisor

Date: 2026-09-27. Implemented locally on `feat/advisor-companion`; not pushed or deployed.

## What was already there

Advisor already recorded microphone audio, sent it to ElevenLabs for transcription, passed the transcript to the shared Nova advisor, and used ElevenLabs to speak the answer. Scout's popup had no microphone or playback controls. The old voice hook belonged to the Advisor page, so navigating away could interrupt the experience.

## What works now

Both surfaces use one `VoiceProvider`, mounted above the router inside `ChatProvider`:

1. Press **Ask by voice**, allow microphone access and speak. Scout takes the listening pose and shows the input level.
2. Press the square to submit. A recording stops automatically after 60 seconds. **Cancel recording** discards it without uploading.
3. The submitted question uses the page/tool identifiers captured when recording began. Scout's selection-sharing opt-out applies to voice too.
4. The screened transcript and AI answer enter the shared thread. The answer appears before speech is ready.
5. ElevenLabs reads the answer. Pause, resume or stop from either surface. **Listen** also reads typed answers aloud.

A submitted question and its playback survive navigation between Scout and Advisor without duplicate transcription, model or speech requests. Closing an unsent recording releases the microphone, including permission granted after the popup was closed. Explicitly closing Scout stops audio and suppresses delayed playback; a submitted answer can still finish into the thread.

The shared conversation lock prevents text and voice requests from racing. An in-memory cache reuses the latest spoken text's unexpired audio URL; it does not persist recordings or signed audio URLs in localStorage. Existing server-side audio storage/retention is unchanged.

## Existing backend flow

```text
Microphone → signed S3 upload
           → /voice/turn: ElevenLabs STT → guarded Nova advisor
           → screened transcript + answer + source receipts
           → /voice/speak: ElevenLabs TTS → signed audio URL
           → one shared browser audio player
```

ElevenLabs handles speech conversion; Nova remains the reasoning model. The repository configures `scribe_v1` for STT and `eleven_flash_v2_5` for TTS through SAM parameters. This milestone does not change providers, models, deployment configuration or credentials. The provider uses ElevenLabs' [transcription endpoint](https://elevenlabs.io/docs/api-reference/speech-to-text/convert) and [speech synthesis endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).

The TTS route strips Markdown, numeric source markers and Markdown link destinations before speaking. Citations stay visible in the transcript. The existing 2,000-character spoken-output cap remains, with a sentence-boundary trim. Empty content after normalization is rejected before calling ElevenLabs.

## Boundaries and verification

This is tap-to-record conversation, not continuous listening, live transcript streaming, interruption detection or a voice navigation/transaction command system. Questions can refer to the selected company/lesson/scenario; the existing AI explains them. Voice uses the finance/privacy guardrail and ordinary source context, not the separate standalone source-QA grounding check.

A denied microphone focuses the typed composer. Empty speech gives a retry message. TTS or browser autoplay failure leaves the completed answer visible and offers Listen as a manual retry. Stopping while speech is being generated prevents late audio from starting.

The browser suite exercises synthetic MediaRecorder audio, context on both surfaces, navigation during inference/playback, shared request exclusion, selection opt-out, denied/late microphone permission, cancellation, empty speech, TTS failure, autoplay failure, replay and 320px controls. It intercepts all provider/API activity; it does not evaluate real ElevenLabs voice quality or latency. The existing voice/backend unit tests cover request contracts and output normalization.

Before the demo, verify the authorized deployment has the updated frontend/backend and the existing ElevenLabs/Bedrock configuration. Test a spoken question and a typed-answer Listen action over HTTPS or localhost in the target browser. Safari/iOS and live provider playback were not verified in this milestone.
