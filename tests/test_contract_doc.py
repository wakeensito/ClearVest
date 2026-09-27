"""The contract file itself: every spec route present, every example valid against its schema."""

from tests.contract import SPEC, assert_matches

ROUTES = {
    ("/health", "get"), ("/profile", "get"), ("/profile", "put"),
    ("/plaid/link-token", "post"), ("/plaid/exchange", "post"), ("/plaid/sandbox-link", "post"),
    ("/portfolio/holdings", "get"), ("/portfolio/risk", "get"),
    ("/market/history", "get"), ("/market/compare-companies", "get"), ("/market/macro", "get"),
    ("/market/templates", "get"), ("/market/fund", "get"),
    ("/advisor/chat", "post"), ("/advisor/retirement-accounts", "get"), ("/advisor/history", "delete"),
    ("/voice/upload-url", "post"), ("/voice/turn", "post"), ("/voice/speak", "post"),
}


def test_every_route_documented():
    documented = {(p, m) for p, ops in SPEC["paths"].items() for m in ops if m in {"get", "put", "post", "delete"}}
    assert ROUTES <= documented


def test_every_example_matches_its_schema():
    for path, ops in SPEC["paths"].items():
        for method, op in ops.items():
            if method not in {"get", "put", "post", "delete"}:
                continue
            for status, resp in op["responses"].items():
                media = resp.get("content", {}).get("application/json")
                if media and "example" in media:
                    assert_matches(path, method, int(status), media["example"])
