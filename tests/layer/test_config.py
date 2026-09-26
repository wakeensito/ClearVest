"""Tests for clearvest.config: SSM-backed secrets, cached per container."""

import pytest
from clearvest import config
from clearvest.errors import UpstreamError


def test_get_secret_reads_and_caches(aws, monkeypatch):
    assert config.get_secret("FMP_KEY_PARAM") == "fmp-key"
    import boto3

    boto3.client("ssm").put_parameter(Name="clearvest-fmp", Value="rotated", Type="SecureString", Overwrite=True)
    assert config.get_secret("FMP_KEY_PARAM") == "fmp-key"  # cached per container


def test_missing_parameter_is_upstream_error(aws, monkeypatch):
    monkeypatch.setenv("FMP_KEY_PARAM", "clearvest-does-not-exist")
    with pytest.raises(UpstreamError) as err:
        config.get_secret("FMP_KEY_PARAM")
    assert err.value.provider == "config"
    assert "clearvest-does-not-exist" in err.value.detail


def test_parameter_name_adds_slash_for_hierarchies():
    assert config.parameter_name("clearvest-fmp") == "clearvest-fmp"
    assert config.parameter_name("clearvest/fmp") == "/clearvest/fmp"
    assert config.parameter_name("/clearvest/fmp") == "/clearvest/fmp"
