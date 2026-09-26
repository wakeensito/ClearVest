"""POST /voice/speak: text-to-speech into S3, returned as a presigned GET (keeps responses small)."""

import os
import uuid

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, aws
from clearvest.advisor import plain_speech
from pydantic import BaseModel, Field

from voice import elevenlabs

router = Router()
EXPIRES = 900
MAX_SPOKEN = 2000  # ElevenLabs cost/latency cap; advisor replies can run longer
BOUNDARIES = (". ", "! ", "? ")


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


def speakable(text: str) -> str:
    """Strip markdown (so TTS never reads it), then trim to <= MAX_SPOKEN chars at the last sentence end,
    or hard-cut if there is none."""
    text = plain_speech(text)
    if len(text) <= MAX_SPOKEN:
        return text
    window = text[: MAX_SPOKEN + 1]  # one extra char so a boundary ending exactly at the cap counts
    end = max(window.rfind(b) for b in BOUNDARIES)
    return window[: end + 1] if end >= 0 else text[:MAX_SPOKEN]


@router.post("/voice/speak")
def speak():
    uid = api.user_id(router)
    text = speakable(api.parse(SpeakRequest, api.json_body(router)).text)
    key = f"audio/out/{uid}/{uuid.uuid4()}.mp3"
    bucket = os.environ["AUDIO_BUCKET"]
    aws.s3().put_object(Bucket=bucket, Key=key, Body=elevenlabs.synthesize(text), ContentType="audio/mpeg")
    url = aws.s3().generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=EXPIRES)
    return {"audioUrl": url, "expiresIn": EXPIRES}
