"""POST /voice/upload-url: a presigned PUT so audio never passes through API Gateway (10 MB / 30 s limits)."""

import os
import uuid
from typing import Literal

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api, aws
from pydantic import BaseModel

router = Router()
EXPIRES = 900


class UploadRequest(BaseModel):
    contentType: Literal["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"]


@router.post("/voice/upload-url")
def upload_url():
    uid = api.user_id(router)
    req = api.parse(UploadRequest, api.json_body(router))
    key = f"audio/in/{uid}/{uuid.uuid4()}"
    url = aws.s3().generate_presigned_url(
        "put_object", Params={"Bucket": os.environ["AUDIO_BUCKET"], "Key": key, "ContentType": req.contentType},
        ExpiresIn=EXPIRES,
    )
    return {"uploadUrl": url, "key": key, "expiresIn": EXPIRES}
