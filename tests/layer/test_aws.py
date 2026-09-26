"""clearvest.aws: the bedrock() client's timeout/retry budget is env-configurable.

BEDROCK_MAX_ATTEMPTS is passed to botocore as `total_max_attempts` (total attempts,
initial + retries), not botocore's own `max_attempts` (which counts retries only) --
that's the semantic the env var name promises, and it's what `client.meta.config.retries`
exposes either way once a client is built.
"""

from clearvest import aws


def test_bedrock_default_budget():
    aws.reset()
    client = aws.bedrock()
    assert client.meta.config.read_timeout == 12
    assert client.meta.config.retries["total_max_attempts"] == 2  # default: 2 total attempts
    aws.reset()


def test_bedrock_honors_env_overrides(monkeypatch):
    monkeypatch.setenv("BEDROCK_MAX_ATTEMPTS", "1")
    monkeypatch.setenv("BEDROCK_READ_TIMEOUT", "12")
    aws.reset()
    client = aws.bedrock()
    assert client.meta.config.retries["total_max_attempts"] == 1  # voice: 1 total attempt
    assert client.meta.config.read_timeout == 12
    aws.reset()
