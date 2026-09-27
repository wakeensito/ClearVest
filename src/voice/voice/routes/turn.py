"""POST /voice/turn: speech-to-text, then the same advisor as /advisor/chat.

Only keys under the caller's own audio/in/<userId>/ prefix are accepted.
"""

import os

from aws_lambda_powertools.event_handler.api_gateway import Router
from botocore.exceptions import ClientError
from clearvest import advisor, api, aws
from clearvest.errors import InvalidInput, UpstreamError
from clearvest.scout_context import PageContext
from pydantic import BaseModel, Field

from voice import elevenlabs

router = Router()
MAX_BYTES = 10 * 1024 * 1024
NOT_FOUND_CODES = {"404", "NoSuchKey", "NotFound"}


class TurnRequest(BaseModel):
    key: str = Field(min_length=1, max_length=300)
    context: PageContext | None = None


@router.post("/voice/turn")
def turn():
    uid = api.user_id(router)
    request = api.parse(TurnRequest, api.json_body(router))
    key = request.key
    prefix = f"audio/in/{uid}/"
    suffix = key[len(prefix):]
    if not key.startswith(prefix) or not suffix or ".." in key or "/" in suffix:
        raise InvalidInput("key: not one of your uploads")
    bucket = os.environ["AUDIO_BUCKET"]
    try:
        head = aws.s3().head_object(Bucket=bucket, Key=key)
    except ClientError as err:
        code = err.response["Error"]["Code"]
        if code in NOT_FOUND_CODES:
            raise InvalidInput("key: upload not found (did the PUT finish?)") from err
        raise UpstreamError("s3", code) from err
    if head["ContentLength"] > MAX_BYTES:
        raise InvalidInput("Recording is too long (max 10 MB)")
    obj = aws.s3().get_object(Bucket=bucket, Key=key)
    transcript = elevenlabs.transcribe(obj["Body"].read(), head.get("ContentType") or "audio/webm")
    if not transcript:
        raise InvalidInput("I didn't catch that. Try recording again.")
    result = advisor.answer(uid, transcript, mode="voice", **({"context": request.context} if request.context else {}))
    return {"transcript": result.get("userMessage", "Transcript withheld because safety checks were unavailable."), "reply": result["reply"], "disclaimer": result["disclaimer"], **{k: result[k] for k in ("safety", "sources") if k in result}}
