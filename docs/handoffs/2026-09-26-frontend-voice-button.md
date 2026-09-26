# Voice button on the Advisor page

- **Date:** 2026-09-26
- **Author:** @Mario-Recondo
- **Team:** frontend
- **Status:** done
- **PR / issue:** #22 (voice advisor), P1 in the frontend scaffold handoff
- **Branch:** feat/voice-button
- **Follows:** 2026-09-26-frontend-scaffold-design-system.md, 2026-09-26-ai-advisor-voice.md, 2026-09-26-backend-cors-preflight.md

## What changed

- A mic button in the Advisor composer, left of Send. Click or Space to record, again to stop.
  Recording auto-stops at 60 seconds.
- The full voice flow from `docs/api/README.md`: `POST /voice/upload-url`, `PUT` the blob to S3,
  `POST /voice/turn`, both sides of the exchange land in the chat thread at once, then
  `POST /voice/speak` and the reply plays.
- While the reply plays the same button pauses and resumes, and a Stop link ends it.
- A live level meter (24 bars from a Web Audio analyser on the mic stream) shows while recording, so
  the speaker can see they are being heard.
- Status and errors under the composer in an `aria-live` region, using the two voice rows from
  DESIGN.md §11. A denied microphone moves focus to the text box.
- `ChatState.addTurn(userText, reply, disclaimer?)` on the chat context, so a finished exchange from
  another channel can join the thread without a request.

New files: `features/advisor/useVoiceTurn.ts`, `VoiceButton.tsx`, `VoiceButton.module.css`,
`Waveform.tsx`, `lib/voice.ts` (+ test). Small edits: `api/client.ts`, `chatContext.ts`,
`ChatProvider.tsx`, `AdvisorPage.tsx`.

## How to run / verify it

```bash
npm run lint -w frontend && npm run typecheck -w frontend
npm test -w frontend -- --run src/lib/voice.test.ts     # 6 tests
# Against the real API (the Prism mock can't do the S3 PUT):
echo "VITE_API_BASE_URL=<ApiUrl>" > frontend/.env.local && npm run dev
```

Open `/advisor`, allow the microphone, ask a question out loud. DevTools Network shows, in order:
`upload-url` 200, S3 `PUT` 200, `turn` 200 (10–25 s), `speak` 200, then the mp3. Block the mic in the
address bar and press the button: "Microphone access is off. You can type your question instead."
and focus lands in the composer.

Verified in Chrome on Windows against the deployed stack on 2026-09-26.

## Decisions & why

- **The transcript appears only when the turn finishes.** `/voice/turn` returns transcript and reply
  together; there is no streaming STT. The thinking dots cover the wait.
- **Pause/resume on the same button, Stop as a link.** One control in the composer keeps the layout
  stable; the destructive action is one step further away.
- **A playback failure is a soft error.** The reply is already in the thread, so `/voice/speak` or
  `Audio.play()` failing shows "Couldn't play the reply. It's in the chat above." instead of a failed turn.
- **Pure logic lives in `lib/voice.ts`** (format pick, error copy) because vitest runs in a node
  environment with no DOM. The hook and components are verified by hand, not by tests.
- **Content-Type is picked once and used three times.** `MediaRecorder` gets the codec form
  (`audio/webm;codecs=opus`); the API and the S3 PUT get the bare form (`audio/webm`). S3 rejects the
  PUT with 403 if it differs from what `upload-url` was asked for.
- **Sequential calls on purpose.** `/voice/*` is throttled to 2 req/s.

## Gotchas

- **The Prism mock can't complete a voice turn.** Its `uploadUrl` is a fake S3 URL, so the PUT fails.
  Test voice against the deployed API only.
- **Autoplay.** `Audio.play()` runs seconds after the click, inside the same interaction chain. Chrome
  and Firefox allow it; if a browser refuses, the soft playback error shows and the text is still there.
- **Safari records `audio/mp4`**, which the API accepts. Not tested on Safari today.
- **`pending` vs voice.** The typed path's `chat.pending` and the voice hook's status are separate. The
  page ORs them for the thinking indicator. Send is disabled while a typed request is in flight; the
  mic is disabled while uploading or thinking.
- The token test `src/styles/tokens.test.ts` fails on this Windows checkout on `main` too; unrelated,
  CI is green.

## Next steps

1. Once #35 (CloudFront hosting) is live, test the voice flow from the hosted site: a different origin
   and a real HTTPS page, which the microphone API requires outside localhost.
2. Company comparison screen on Markets (`/market/compare-companies`), the last backend route with no UI.
3. Optional: a mute toggle so voice questions don't always speak the reply.

## Open questions / blockers

- None for this slice.
