"""POST /voice/turn: speech-to-text, then the same advisor as /advisor/chat.

Only keys under the caller's own audio/in/<userId>/ prefix are accepted.
"""

import os

from aws_lambda_powertools.event_handler.api_gateway import Router
from botocore.exceptions import ClientError
from clearvest import advisor, api, aws
from clearvest.errors import InvalidInput
from pydantic import BaseModel, Field

from voice import elevenlabs

router = Router()
MAX_BYTES = 10 * 1024 * 1024


class TurnRequest(BaseModel):
    key: str = Field(min_length=1, max_length=300)


@router.post("/voice/turn")
def turn():
    uid = api.user_id(router)
    key = api.parse(TurnRequest, api.json_body(router)).key
    prefix = f"audio/in/{uid}/"
    if not key.startswith(prefix) or ".." in key or "/" in key[len(prefix):]:
        raise InvalidInput("key: not one of your uploads")
    bucket = os.environ["AUDIO_BUCKET"]
    try:
        head = aws.s3().head_object(Bucket=bucket, Key=key)
    except ClientError as err:
        raise InvalidInput("key: upload not found (did the PUT finish?)") from err
    if head["ContentLength"] > MAX_BYTES:
        raise InvalidInput("Recording is too long (max 10 MB)")
    obj = aws.s3().get_object(Bucket=bucket, Key=key)
    transcript = elevenlabs.transcribe(obj["Body"].read(), head.get("ContentType") or "audio/webm")
    if not transcript:
        raise InvalidInput("I didn't catch that. Try recording again.")
    result = advisor.answer(uid, transcript)
    return {"transcript": transcript, "reply": result["reply"], "disclaimer": result["disclaimer"]}
