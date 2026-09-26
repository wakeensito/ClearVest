"""API keys from SSM Parameter Store.

Each function gets env vars like FMP_KEY_PARAM=clearvest-fmp holding the parameter
*name*, so teammates can rename parameters in samconfig without code changes. A
missing parameter fails only the route that needs it (502), never cold start.
"""

import os

from botocore.exceptions import ClientError

from clearvest import aws
from clearvest.errors import UpstreamError

_cache: dict[str, str] = {}


def parameter_name(raw: str) -> str:
    """SSM hierarchies need a leading slash; the template passes names without one so ARNs stay valid."""
    return f"/{raw.lstrip('/')}" if "/" in raw else raw


def get_secret(env_var: str) -> str:
    raw = os.environ.get(env_var, "")
    if not raw:
        raise UpstreamError("config", f"{env_var} is not set")
    name = parameter_name(raw)
    if name not in _cache:
        try:
            resp = aws.ssm().get_parameter(Name=name, WithDecryption=True)
        except ClientError as err:
            raise UpstreamError("config", f"SSM parameter {name}: {err.response['Error']['Code']}") from err
        _cache[name] = resp["Parameter"]["Value"]
    return _cache[name]


def reset() -> None:
    _cache.clear()
