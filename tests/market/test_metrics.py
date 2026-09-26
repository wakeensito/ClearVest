"""Tests for market.metrics: return, volatility and chart downsampling."""

import pytest

from market import metrics


def test_return_pct():
    assert metrics.return_pct([100, 110, 121]) == pytest.approx(21.0)


def test_volatility_flat_is_zero():
    assert metrics.volatility([100, 100, 100], 252) == 0.0


def test_volatility_annualizes():
    closes = [100, 101, 100, 101, 100]
    assert metrics.volatility(closes, 252) > metrics.volatility(closes, 52)


def test_downsample_keeps_last_point():
    pts = [(str(i), float(i)) for i in range(1000)]
    out = metrics.downsample(pts, 260)
    assert len(out) <= 261 and out[-1] == pts[-1] and out[0] == pts[0]


def test_short_series():
    assert metrics.return_pct([5]) == 0.0 and metrics.volatility([5], 252) == 0.0


def test_volatility_zero_when_per_year_zero():
    assert metrics.volatility([100, 101, 100, 101], 0) == 0.0
