"""Powertools HTTP API app factory shared by all four functions.

One error handler everywhere: AppError -> envelope, anything else -> INTERNAL with
the Lambda request id so it can be found in CloudWatch.
"""

import json
import uuid

from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import (
    APIGatewayHttpResolver,
    Response,
    content_types,
)
from aws_lambda_powertools.logging import correlation_paths
from pydantic import BaseModel, ValidationError

from clearvest.errors import AppError, InvalidInput, UpstreamError

logger = Logger()

# The Lambda context of the invocation being handled (set per call by make_handler's handler), so
# provider clients can size their timeouts to the time the function actually has left.
_context = None
NO_CONTEXT_SECONDS = 60.0


def _error(app: APIGatewayHttpResolver, code: str, status: int, message: str) -> Response:
    request_id = getattr(app.lambda_context, "aws_request_id", None)
    return Response(
        status_code=status,
        content_type=content_types.APPLICATION_JSON,
        body=json.dumps({"error": {"code": code, "message": message, "requestId": request_id}}),
    )


def create_app(*routers) -> APIGatewayHttpResolver:
    app = APIGatewayHttpResolver()
    for router in routers:
        app.include_router(router)

    @app.exception_handler(AppError)
    def _app_error(err: AppError):
        if isinstance(err, UpstreamError):
            logger.warning("upstream failure", extra={"provider": err.provider, "detail": err.detail})
        return _error(app, err.code, err.status, err.message)

    @app.not_found
    def _not_found(_err):
        return _error(app, "NOT_FOUND", 404, "No such route")

    @app.exception_handler(Exception)
    def _unexpected(err: Exception):
        logger.exception("unhandled error")
        return _error(app, "INTERNAL", 500, "Something went wrong")

    return app


def make_handler(app: APIGatewayHttpResolver):
    @logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_HTTP, clear_state=True)
    def handler(event, context):
        # Routes are `ANY /x/{proxy+}`, so API Gateway forwards CORS preflights here instead of
        # answering them itself. Browsers need a 2xx; the gateway adds the CORS headers.
        if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
            return {"statusCode": 204, "body": ""}
        global _context
        _context = context
        try:
            return app.resolve(event, context)
        finally:
            _context = None

    return handler


def remaining_seconds() -> float:
    """Seconds left before this Lambda invocation times out; a generous default outside Lambda
    (tests, scripts) or when the context has no timer."""
    timer = getattr(_context, "get_remaining_time_in_millis", None)
    return timer() / 1000 if timer else NO_CONTEXT_SECONDS


def user_id(router) -> str:
    raw = (router.current_event.headers or {}).get("x-user-id", "")
    try:
        value = str(uuid.UUID(raw))
    except ValueError as err:
        raise InvalidInput("X-User-Id header must be a UUID") from err
    logger.append_keys(userId=value)
    return value


def json_body(router) -> dict:
    try:
        body = router.current_event.json_body
    except (ValueError, TypeError) as err:
        raise InvalidInput("Body must be a JSON object") from err
    if not isinstance(body, dict):
        raise InvalidInput("Body must be a JSON object")
    return body


def parse(model: type[BaseModel], data: dict):
    try:
        return model.model_validate(data)
    except ValidationError as err:
        first = err.errors()[0]
        where = ".".join(str(p) for p in first["loc"]) or "body"
        raise InvalidInput(f"{where}: {first['msg']}") from err
