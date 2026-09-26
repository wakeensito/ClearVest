"""clearvest.aws: the bedrock() client's timeout/retry budget is env-configurable.

Note: botocore's Config takes `max_attempts` (= retries), but once a client is built
it normalizes that into `total_max_attempts` (= max_attempts + 1, counting the initial
try) on `client.meta.config.retries` -- there is no `max_attempts` key on a live
client's resolved config. These tests assert on `total_max_attempts` accordingly.
"""

from clearvest import aws


def test_bedrock_default_budget():
    aws.reset()
    client = aws.bedrock()
    assert client.meta.config.read_timeout == 12
    assert client.meta.config.retries["total_max_attempts"] == 3  # max_attempts=2 (default)
    aws.reset()


def test_bedrock_honors_env_overrides(monkeypatch):
    monkeypatch.setenv("BEDROCK_MAX_ATTEMPTS", "1")
    monkeypatch.setenv("BEDROCK_READ_TIMEOUT", "12")
    aws.reset()
    client = aws.bedrock()
    assert client.meta.config.retries["total_max_attempts"] == 2  # max_attempts=1 (voice)
    assert client.meta.config.read_timeout == 12
    aws.reset()
