"""Tests for the voice Lambda: presigned upload, STT -> advisor turn, TTS speak."""

import os

import responses
from clearvest import advisor
from clearvest import aws as aws_mod  # the fixture is also named `aws`
from voice.app import handler

from tests.contract import assert_matches
from tests.helpers import USER, call
from voice import elevenlabs

BUCKET = os.environ["AUDIO_BUCKET"]


def test_upload_url_scoped_to_user(aws):
    status, body = call(handler, "POST", "/voice/upload-url", {"contentType": "audio/webm"})
    assert status == 200 and body["key"].startswith(f"audio/in/{USER}/")
    assert "s3.us-east-1.amazonaws.com" in body["uploadUrl"] and body["key"] in body["uploadUrl"]
    assert_matches("/voice/upload-url", "post", 200, body)


def test_upload_rejects_non_audio(aws):
    assert call(handler, "POST", "/voice/upload-url", {"contentType": "text/html"})[0] == 400


def test_turn_transcribes_and_answers(aws, monkeypatch):
    key = f"audio/in/{USER}/rec1"
    aws_mod.s3().put_object(Bucket=BUCKET, Key=key, Body=b"fake-audio", ContentType="audio/webm")
    monkeypatch.setattr(elevenlabs, "transcribe", lambda audio, ct: "I'm 63 and retiring soon")
    monkeypatch.setattr(advisor, "answer", lambda uid, msg: {"reply": f"echo {msg}", "disclaimer": "d"})
    status, body = call(handler, "POST", "/voice/turn", {"key": key})
    assert status == 200 and body == {"transcript": "I'm 63 and retiring soon", "reply": "echo I'm 63 and retiring soon", "disclaimer": "d"}
    assert_matches("/voice/turn", "post", 200, body)


def test_turn_rejects_other_users_key(aws):
    other = "00000000-0000-4000-8000-000000000000"
    aws_mod.s3().put_object(Bucket=BUCKET, Key=f"audio/in/{other}/rec", Body=b"x")
    for key in (f"audio/in/{other}/rec", f"audio/in/{USER}/../{other}/rec", "audio/out/x.mp3"):
        status, body = call(handler, "POST", "/voice/turn", {"key": key})
        assert status == 400 and body["error"]["code"] == "VALIDATION"


def test_turn_missing_upload_and_empty_transcript(aws, monkeypatch):
    assert call(handler, "POST", "/voice/turn", {"key": f"audio/in/{USER}/nope"})[0] == 400
    aws_mod.s3().put_object(Bucket=BUCKET, Key=f"audio/in/{USER}/silence", Body=b"x")
    monkeypatch.setattr(elevenlabs, "transcribe", lambda audio, ct: "")
    status, body = call(handler, "POST", "/voice/turn", {"key": f"audio/in/{USER}/silence"})
    assert status == 400 and "catch" in body["error"]["message"]


def test_speak_stores_mp3_and_returns_url(aws, monkeypatch):
    monkeypatch.setattr(elevenlabs, "synthesize", lambda text: b"ID3fake")
    status, body = call(handler, "POST", "/voice/speak", {"text": "Hello"})
    assert status == 200 and body["expiresIn"] == 900
    keys = [o["Key"] for o in aws_mod.s3().list_objects_v2(Bucket=BUCKET)["Contents"]]
    assert any(k.startswith(f"audio/out/{USER}/") and k.endswith(".mp3") for k in keys)
    assert_matches("/voice/speak", "post", 200, body)


def test_speak_validates_text(aws):
    assert call(handler, "POST", "/voice/speak", {"text": ""})[0] == 400
    assert call(handler, "POST", "/voice/speak", {"text": "x" * 2001})[0] == 400


@responses.activate
def test_elevenlabs_clients(aws):
    responses.post("https://api.elevenlabs.io/v1/speech-to-text", json={"text": " hi there "})
    responses.post("https://api.elevenlabs.io/v1/text-to-speech/voice-test", body=b"MP3")
    assert elevenlabs.transcribe(b"a", "audio/webm") == "hi there"
    assert elevenlabs.synthesize("hi") == b"MP3"
    assert responses.calls[0].request.headers["xi-api-key"] == "el-key"
    assert b"scribe_v1" in responses.calls[0].request.body
