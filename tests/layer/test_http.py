"""Tests for clearvest.http: typed failures around requests, no network."""

import pytest
import requests
import responses
from clearvest import http
from clearvest.errors import UpstreamError


@responses.activate
def test_request_json_ok():
    responses.get("https://x.test/a", json={"ok": True})
    assert http.request_json("GET", "https://x.test/a", provider="x") == {"ok": True}


@responses.activate
def test_http_error_becomes_upstream_error():
    responses.get("https://x.test/a", status=402, body="premium only")
    with pytest.raises(UpstreamError) as err:
        http.request_json("GET", "https://x.test/a", provider="fmp")
    assert err.value.provider == "fmp"
    assert "402" in err.value.detail
    assert "fmp" in err.value.message


@responses.activate
def test_connection_error_becomes_upstream_error():
    responses.get("https://x.test/a", body=requests.ConnectionError("nope"))
    with pytest.raises(UpstreamError):
        http.request("GET", "https://x.test/a", provider="x")


@responses.activate
def test_connection_error_detail_omits_query_string_secrets():
    responses.get("https://x.test/a?api_key=SECRET123", body=requests.ConnectionError("nope"))
    with pytest.raises(UpstreamError) as err:
        http.request("GET", "https://x.test/a?api_key=SECRET123", provider="x")
    assert "SECRET123" not in err.value.detail
    assert "x.test/a" in err.value.detail


@responses.activate
def test_non_json_body_becomes_upstream_error():
    responses.get("https://x.test/a", body="<html>")
    with pytest.raises(UpstreamError):
        http.request_json("GET", "https://x.test/a", provider="x")
