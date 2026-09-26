"""ElevenLabs speech-to-text (Scribe) and text-to-speech. Model and voice ids are env vars."""

import os

from clearvest import config, http


def _headers() -> dict:
    return {"xi-api-key": config.get_secret("ELEVENLABS_KEY_PARAM")}


def transcribe(audio: bytes, content_type: str) -> str:
    resp = http.request_json(
        "POST", "https://api.elevenlabs.io/v1/speech-to-text", provider="elevenlabs", timeout=15,
        headers=_headers(), data={"model_id": os.environ["ELEVENLABS_STT_MODEL"]},
        files={"file": ("recording", audio, content_type)},
    )
    return (resp.get("text") or "").strip()


def synthesize(text: str) -> bytes:
    resp = http.request(
        "POST", f"https://api.elevenlabs.io/v1/text-to-speech/{os.environ['ELEVENLABS_VOICE_ID']}",
        provider="elevenlabs", timeout=15, headers=_headers(), params={"output_format": "mp3_44100_128"},
        json={"text": text, "model_id": os.environ["ELEVENLABS_TTS_MODEL"]},
    )
    return resp.content
