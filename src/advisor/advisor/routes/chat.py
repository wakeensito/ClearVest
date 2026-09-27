"""POST /advisor/chat, DELETE /advisor/history."""

from aws_lambda_powertools.event_handler import Response
from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import advisor, api, db
from clearvest.scout_context import PageContext
from pydantic import BaseModel, Field, StrictBool

router = Router()


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    grounded: StrictBool = False
    context: PageContext | None = None


@router.post("/advisor/chat")
def chat():
    uid = api.user_id(router)
    req = api.parse(ChatRequest, api.json_body(router))
    return advisor.answer(uid, req.message, grounded=req.grounded, context=req.context)


@router.delete("/advisor/history")
def clear_history():
    db.delete_prefix(db.user_pk(api.user_id(router)), "CHAT#")
    return Response(status_code=204)
