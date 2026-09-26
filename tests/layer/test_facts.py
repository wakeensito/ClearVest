from clearvest import facts


def test_retirement_accounts_returns_four_verified_accounts():
    accounts = facts.retirement_accounts()
    assert {a["id"] for a in accounts} == {"traditional-401k", "roth-401k", "roth-ira", "tsp"}
    for a in accounts:
        assert a["taxTreatment"] and a["contributionLimit"] and a["bestFor"] and a["source"]


def test_retirement_accounts_is_cached(monkeypatch):
    facts.retirement_accounts.cache_clear()
    calls = []
    real_loads = facts.json.loads

    def counting_loads(*a, **kw):
        calls.append(1)
        return real_loads(*a, **kw)

    monkeypatch.setattr(facts.json, "loads", counting_loads)
    first = facts.retirement_accounts()
    second = facts.retirement_accounts()
    assert first is second
    assert len(calls) == 1
    facts.retirement_accounts.cache_clear()
