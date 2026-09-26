"""POST /voice/speak: text-to-speech into S3, returned as a presigned GET (keeps responses small)."""

import os
import uuid

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, aws
from pydantic import BaseModel, Field

from voice import elevenlabs

router = Router()
EXPIRES = 900


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@router.post("/voice/speak")
def speak():
    uid = api.user_id(router)
    text = api.parse(SpeakRequest, api.json_body(router)).text
    key = f"audio/out/{uid}/{uuid.uuid4()}.mp3"
    bucket = os.environ["AUDIO_BUCKET"]
    aws.s3().put_object(Bucket=bucket, Key=key, Body=elevenlabs.synthesize(text), ContentType="audio/mpeg")
    url = aws.s3().generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=EXPIRES)
    return {"audioUrl": url, "expiresIn": EXPIRES}
