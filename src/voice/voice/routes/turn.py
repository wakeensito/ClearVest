"""Speech-to-text on an uploaded recording, then an advisor reply."""

from aws_lambda_powertools.event_handler.api_gateway import Router

router = Router()
