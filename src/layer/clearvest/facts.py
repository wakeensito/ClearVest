"""Verified, sourced facts the model is allowed to cite. Never generated: read from JSON, cached in memory.

Both AdvisorFn (chat + retirement-accounts) and VoiceFn read the same file, so the numbers a user hears
in chat, voice, or the static retirement-accounts page can never drift apart.
"""

import functools
import json
from pathlib import Path

_DATA_DIR = Path(__file__).parent / "data"


@functools.lru_cache(maxsize=1)
def retirement_accounts() -> list[dict]:
    """The four retirement account types, with verified tax treatment, contribution limits and sources."""
    return json.loads((_DATA_DIR / "retirement_accounts.json").read_text())
