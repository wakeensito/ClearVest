"""Return, volatility and chart downsampling, computed in code (never by the model)."""

import math
import statistics
from itertools import pairwise


def return_pct(closes: list[float]) -> float:
    if len(closes) < 2 or closes[0] == 0:
        return 0.0
    return round((closes[-1] / closes[0] - 1) * 100, 2)


def volatility(closes: list[float], periods_per_year: float) -> float:
    """Annualized standard deviation of log returns, in percent."""
    rets = [math.log(b / a) for a, b in pairwise(closes) if a > 0 and b > 0]
    if len(rets) < 2:
        return 0.0
    return round(statistics.stdev(rets) * math.sqrt(periods_per_year) * 100, 2)


def downsample(points: list, max_points: int = 260) -> list:
    if len(points) <= max_points:
        return points
    step = math.ceil(len(points) / max_points)
    out = points[::step]
    if out[-1] != points[-1]:
        out.append(points[-1])
    return out
