"""Guards on template.yaml: least privilege, no committed account IDs, every route wired."""

import re
from pathlib import Path

import yaml

TEMPLATE = Path("template.yaml")


class _CfnLoader(yaml.SafeLoader):
    """SafeLoader that reads CloudFormation short-form tags (!Ref, !Sub...) as plain values."""


def _cfn_tag(loader, _suffix, node):
    if isinstance(node, yaml.ScalarNode):
        return loader.construct_scalar(node)
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    return loader.construct_mapping(node)


_CfnLoader.add_multi_constructor("!", _cfn_tag)


def load():
    return yaml.load(TEMPLATE.read_text(), Loader=_CfnLoader)


def test_no_account_ids_or_literal_arns():
    text = TEMPLATE.read_text()
    assert not re.search(r"\b\d{12}\b", text)
    assert "arn:aws:" not in text  # always arn:${AWS::Partition}:...


def test_four_functions_share_layer():
    res = load()["Resources"]
    fns = {k for k, v in res.items() if v["Type"] == "AWS::Serverless::Function"}
    assert fns == {"PortfolioFn", "MarketFn", "AdvisorFn", "VoiceFn"}
    assert res["SharedLayer"]["Metadata"]["BuildMethod"] == "python3.12"


def test_only_advisor_and_voice_can_call_bedrock():
    res = load()["Resources"]
    for name in ("PortfolioFn", "MarketFn"):
        assert "bedrock" not in yaml.dump(res[name]["Properties"]["Policies"])
    for name in ("AdvisorFn", "VoiceFn"):
        assert "bedrock:InvokeModel" in yaml.dump(res[name]["Properties"]["Policies"])


def test_only_portfolio_reads_plaid_secrets():
    res = load()["Resources"]
    for name, spec in res.items():
        if spec["Type"] != "AWS::Serverless::Function":
            continue
        has_plaid = "PlaidSecretParam" in yaml.dump(spec["Properties"].get("Policies", []))
        assert has_plaid == (name == "PortfolioFn")


def test_api_is_throttled():
    api = load()["Resources"]["ClearVestApi"]["Properties"]
    assert api["DefaultRouteSettings"]["ThrottlingRateLimit"] <= 20


def test_ai_routes_have_tighter_throttles():
    routes = load()["Resources"]["ClearVestApi"]["Properties"]["RouteSettings"]
    for key in ("ANY /voice/{proxy+}", "ANY /advisor/{proxy+}"):
        assert routes[key]["ThrottlingRateLimit"] <= 2
        assert routes[key]["ThrottlingBurstLimit"] <= 5


def test_market_fn_fits_api_gateway_timeout():
    assert load()["Resources"]["MarketFn"]["Properties"]["Timeout"] == 29


def test_fred_is_keyless():
    text = TEMPLATE.read_text()
    assert "FredKeyParam" not in text
    assert "FRED_KEY_PARAM" not in text
