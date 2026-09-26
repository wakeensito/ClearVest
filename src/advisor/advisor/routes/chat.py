"""POST /advisor/chat, DELETE /advisor/history."""

from aws_lambda_powertools.event_handler import Response
from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import advisor, api, db
from pydantic import BaseModel, Field

router = Router()


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


@router.post("/advisor/chat")
def chat():
    uid = api.user_id(router)
    req = api.parse(ChatRequest, api.json_body(router))
    return advisor.answer(uid, req.message)


@router.delete("/advisor/history")
def clear_history():
    db.delete_prefix(db.user_pk(api.user_id(router)), "CHAT#")
    return Response(status_code=204)
