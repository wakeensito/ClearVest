"""One requests.Session for every provider: short timeouts, one GET retry, typed failures."""

from typing import Any
from urllib.parse import urlsplit

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from clearvest.errors import UpstreamError

_session: requests.Session | None = None


def _get_session() -> requests.Session:
    global _session
    if _session is None:
        # One retry for idempotent methods only (urllib3's default allowed_methods, so no POST):
        # POSTs to Plaid (single-use public tokens) and ElevenLabs (billed per call) must never be
        # replayed. Retry-After is ignored so a 429 can't park the Lambda for its whole timeout.
        retry = Retry(
            total=1,
            backoff_factor=0.3,
            status_forcelist=(429, 500, 502, 503, 504),
            respect_retry_after_header=False,
            raise_on_status=False,
        )
        _session = requests.Session()
        _session.mount("https://", HTTPAdapter(max_retries=retry))
    return _session


def request(method: str, url: str, *, provider: str, timeout: float = 5, **kwargs) -> requests.Response:
    try:
        resp = _get_session().request(method, url, timeout=timeout, **kwargs)
    except requests.RequestException as err:
        # Never str(err) or include the query string: requests embeds the full URL (incl. api
        # keys passed as query params) in its exception messages, and detail gets logged.
        parts = urlsplit(url)
        detail = f"{type(err).__name__} calling {parts.scheme}://{parts.netloc}{parts.path}"
        raise UpstreamError(provider, detail) from err
    if resp.status_code >= 400:
        raise UpstreamError(provider, f"HTTP {resp.status_code}: {resp.text[:200]}")
    return resp


def request_json(method: str, url: str, *, provider: str, timeout: float = 5, **kwargs) -> Any:
    resp = request(method, url, provider=provider, timeout=timeout, **kwargs)
    try:
        return resp.json()
    except ValueError as err:
        raise UpstreamError(provider, "response was not JSON") from err


def reset() -> None:
    global _session
    _session = None
