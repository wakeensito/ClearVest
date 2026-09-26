"""Tests for the voice Lambda: presigned upload, STT -> advisor turn, TTS speak."""

import os

import responses
from botocore.exceptions import ClientError
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
    seen = {}

    def fake_answer(uid, msg, mode="chat"):
        seen["mode"] = mode
        return {"reply": f"echo {msg}", "disclaimer": "d"}

    monkeypatch.setattr(advisor, "answer", fake_answer)
    status, body = call(handler, "POST", "/voice/turn", {"key": key})
    assert status == 200 and body == {"transcript": "I'm 63 and retiring soon", "reply": "echo I'm 63 and retiring soon", "disclaimer": "d"}
    assert seen["mode"] == "voice"
    assert_matches("/voice/turn", "post", 200, body)


def test_turn_rejects_other_users_key(aws):
    other = "00000000-0000-4000-8000-000000000000"
    aws_mod.s3().put_object(Bucket=BUCKET, Key=f"audio/in/{other}/rec", Body=b"x")
    for key in (f"audio/in/{other}/rec", f"audio/in/{USER}/../{other}/rec", "audio/out/x.mp3", f"audio/in/{USER}/"):
        status, body = call(handler, "POST", "/voice/turn", {"key": key})
        assert status == 400 and body["error"]["code"] == "VALIDATION"


def test_turn_s3_error_other_than_not_found_is_upstream(aws, monkeypatch):
    key = f"audio/in/{USER}/rec1"

    def boom(**_kw):
        raise ClientError({"Error": {"Code": "AccessDenied", "Message": "nope"}}, "HeadObject")

    monkeypatch.setattr(aws_mod.s3(), "head_object", boom)
    status, body = call(handler, "POST", "/voice/turn", {"key": key})
    assert status == 502 and body["error"]["code"] == "UPSTREAM_UNAVAILABLE"


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
    assert call(handler, "POST", "/voice/speak", {"text": "x" * 5001})[0] == 400


def test_speak_trims_long_reply_at_sentence_end(aws, monkeypatch):
    spoken = []
    monkeypatch.setattr(elevenlabs, "synthesize", lambda text: spoken.append(text) or b"ID3fake")
    sentence = "Your portfolio is diversified across nine funds today. "  # 55 chars
    reply = (sentence * 48)[:2600]
    assert len(reply) == 2600
    status, _ = call(handler, "POST", "/voice/speak", {"text": reply})
    assert status == 200
    assert len(spoken[0]) <= 2000 and spoken[0].endswith("today.")
    assert reply.startswith(spoken[0])


def test_speakable_boundaries():
    from voice.routes.speak import speakable

    assert speakable("Short. Reply!") == "Short. Reply!"
    assert speakable("x" * 2500) == "x" * 2000  # no sentence boundary: hard cut
    assert speakable("Why? " + "y" * 2500) == "Why?"
    assert speakable("a" * 1998 + "! b") == "a" * 1998 + "!"
    assert speakable("a" * 1999 + ". " + "b" * 10) == "a" * 1999 + "."  # boundary exactly at 2000


def test_speakable_strips_markdown_before_trimming():
    from voice.routes.speak import speakable

    out = speakable("**Bold point**\n- one\n- two\n\n| A | B |\n| --- | --- |\n| x | y |")
    assert "*" not in out and "|" not in out and "#" not in out
    assert "Bold point" in out and "one" in out and "A" in out and "x" in out


@responses.activate
def test_elevenlabs_clients(aws):
    responses.post("https://api.elevenlabs.io/v1/speech-to-text", json={"text": " hi there "})
    responses.post("https://api.elevenlabs.io/v1/text-to-speech/voice-test", body=b"MP3")
    assert elevenlabs.transcribe(b"a", "audio/webm") == "hi there"
    assert elevenlabs.synthesize("hi") == b"MP3"
    assert responses.calls[0].request.headers["xi-api-key"] == "el-key"
    assert b"scribe_v1" in responses.calls[0].request.body
