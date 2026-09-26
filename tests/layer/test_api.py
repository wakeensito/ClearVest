"""Tests for clearvest.api: the Powertools app factory and its error envelope."""

from aws_lambda_powertools.event_handler.api_gateway import Router
from clearvest import api
from clearvest.errors import NotLinked, UpstreamError
from pydantic import BaseModel

from tests.helpers import USER, call

router = Router()


class Echo(BaseModel):
    n: int


@router.post("/echo")
def echo():
    uid = api.user_id(router)
    body = api.parse(Echo, api.json_body(router))
    return {"user": uid, "n": body.n}


@router.get("/linked")
def linked():
    raise NotLinked("Link an account first")


@router.get("/upstream")
def upstream():
    raise UpstreamError("fmp", "HTTP 402")


@router.get("/crash")
def crash():
    raise RuntimeError("secret internals")


handler = api.make_handler(api.create_app(router))


def test_happy_path():
    assert call(handler, "POST", "/echo", {"n": 3}) == (200, {"user": USER, "n": 3})


def test_missing_user_id_is_400():
    status, body = call(handler, "POST", "/echo", {"n": 3}, user=None)
    assert status == 400 and body["error"]["code"] == "VALIDATION"


def test_bad_user_id_is_400():
    status, _ = call(handler, "POST", "/echo", {"n": 3}, user="not-a-uuid")
    assert status == 400


def test_non_json_body_is_400():
    status, body = call(handler, "POST", "/echo", "{nope")
    assert status == 400 and body["error"]["code"] == "VALIDATION"


def test_schema_error_names_field():
    status, body = call(handler, "POST", "/echo", {"n": "x"})
    assert status == 400 and body["error"]["message"].startswith("n:")


def test_app_errors_map_to_envelope():
    assert call(handler, "GET", "/linked")[0] == 409
    status, body = call(handler, "GET", "/upstream")
    assert status == 502
    assert body["error"] == {"code": "UPSTREAM_UNAVAILABLE", "message": "fmp is unavailable right now", "requestId": "req-123"}


def test_unexpected_error_is_500_without_leaking():
    status, body = call(handler, "GET", "/crash")
    assert status == 500 and "secret" not in body["error"]["message"]


def test_unknown_route_is_404_envelope():
    status, body = call(handler, "GET", "/nope")
    assert status == 404 and body["error"]["code"] == "NOT_FOUND"
