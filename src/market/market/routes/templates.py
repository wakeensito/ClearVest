"""GET /market/templates: well-known portfolios to benchmark against (bundled JSON, no provider)."""

import json
from pathlib import Path

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api

router = Router()
TEMPLATES = json.loads((Path(__file__).parent.parent / "data" / "templates.json").read_text())


@router.get("/market/templates")
def list_templates():
    api.user_id(router)
    return TEMPLATES
