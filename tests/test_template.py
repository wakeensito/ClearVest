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


def test_api_functions_and_refresh_worker_share_layer():
    res = load()["Resources"]
    fns = {k for k, v in res.items() if v["Type"] == "AWS::Serverless::Function"}
    assert fns == {"PortfolioFn", "MarketFn", "AdvisorFn", "VoiceFn", "MarketRefreshFn"}
    assert res["SharedLayer"]["Metadata"]["BuildMethod"] == "python3.12"


def test_only_advisor_voice_and_market_fund_can_call_bedrock():
    res = load()["Resources"]
    for name in ("PortfolioFn", "MarketRefreshFn"):
        assert "bedrock" not in yaml.dump(res[name]["Properties"]["Policies"])
    for name in ("AdvisorFn", "VoiceFn"):
        assert "bedrock:InvokeModel" in yaml.dump(res[name]["Properties"]["Policies"])
    # MarketFn may invoke ONLY the fund-explainer's Nova Micro model, never Advisor/Voice's model.
    market_policies = yaml.dump(res["MarketFn"]["Properties"]["Policies"])
    assert "bedrock:InvokeModel" in market_policies
    assert "FundModelId" in market_policies and "FundFoundationModelId" in market_policies
    assert "${ModelId}" not in market_policies and "${FoundationModelId}" not in market_policies


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


def test_portfolio_fn_has_room_for_slow_plaid_sandbox():
    assert load()["Resources"]["PortfolioFn"]["Properties"]["Timeout"] == 29


def test_cd_role_trusts_main_only():
    doc = yaml.load(Path("infra/cicd-role.yaml").read_text(), Loader=_CfnLoader)
    role = next(r for r in doc["Resources"].values() if r["Type"] == "AWS::IAM::Role")
    cond = role["Properties"]["AssumeRolePolicyDocument"]["Statement"][0]["Condition"]
    subs = cond["StringLike"]["token.actions.githubusercontent.com:sub"]
    patterns = [s if isinstance(s, str) else s[0] for s in subs]
    assert patterns == ["repo:${GitHubRepo}:ref:refs/heads/main", "repo:${Owner}@*/${Name}@*:ref:refs/heads/main"]


# --- Frontend hosting (S3 + CloudFront) ---


def test_frontend_bucket_is_fully_private():
    props = load()["Resources"]["FrontendBucket"]["Properties"]
    assert "BucketName" not in props  # generated clearvest-frontendbucket-* name, matches the CD role scope
    pab = props["PublicAccessBlockConfiguration"]
    for flag in ("BlockPublicAcls", "BlockPublicPolicy", "IgnorePublicAcls", "RestrictPublicBuckets"):
        assert pab[flag] is True
    sse = props["BucketEncryption"]["ServerSideEncryptionConfiguration"][0]["ServerSideEncryptionByDefault"]
    assert sse["SSEAlgorithm"] == "AES256"
    assert props["OwnershipControls"]["Rules"][0]["ObjectOwnership"] == "BucketOwnerEnforced"


def test_distribution_uses_oac_and_redirects_to_https():
    res = load()["Resources"]
    oac = res["FrontendOAC"]["Properties"]["OriginAccessControlConfig"]
    assert (oac["OriginAccessControlOriginType"], oac["SigningProtocol"], oac["SigningBehavior"]) == (
        "s3",
        "sigv4",
        "always",
    )
    cfg = res["FrontendDistribution"]["Properties"]["DistributionConfig"]
    assert cfg["Enabled"] is True
    assert cfg["DefaultRootObject"] == "index.html"
    (origin,) = cfg["Origins"]
    assert origin["OriginAccessControlId"] == "FrontendOAC.Id"
    assert origin["S3OriginConfig"]["OriginAccessIdentity"] == ""
    assert origin["DomainName"] == "FrontendBucket.RegionalDomainName"
    behavior = cfg["DefaultCacheBehavior"]
    assert behavior["TargetOriginId"] == origin["Id"]
    assert behavior["ViewerProtocolPolicy"] == "redirect-to-https"


def test_spa_fallback_serves_index_for_403_and_404():
    cfg = load()["Resources"]["FrontendDistribution"]["Properties"]["DistributionConfig"]
    by_code = {e["ErrorCode"]: e for e in cfg["CustomErrorResponses"]}
    assert set(by_code) == {403, 404}
    for entry in by_code.values():
        assert entry["ResponsePagePath"] == "/index.html"
        assert entry["ResponseCode"] == 200
        assert entry["ErrorCachingMinTTL"] == 0


def test_frontend_bucket_policy_scoped_to_distribution():
    props = load()["Resources"]["FrontendBucketPolicy"]["Properties"]
    assert props["Bucket"] == "FrontendBucket"
    (stmt,) = props["PolicyDocument"]["Statement"]
    assert stmt["Effect"] == "Allow"
    assert stmt["Action"] == "s3:GetObject"
    assert stmt["Principal"] == {"Service": "cloudfront.amazonaws.com"}
    assert stmt["Resource"] == "${FrontendBucket.Arn}/*"
    source = stmt["Condition"]["StringEquals"]["AWS:SourceArn"]
    assert source == "arn:${AWS::Partition}:cloudfront::${AWS::AccountId}:distribution/${FrontendDistribution}"


def test_frontend_outputs_exist():
    outputs = load()["Outputs"]
    assert outputs["FrontendUrl"]["Value"] == "https://${FrontendDistribution.DomainName}"
    assert {"FrontendBucketName", "FrontendDistributionId"} <= set(outputs)


def test_frontend_distribution_carries_cd_ownership_tag():
    """The CD role can only write to distributions tagged clearvest:managed-by=clearvest-cicd."""
    tags = load()["Resources"]["FrontendDistribution"]["Properties"]["Tags"]
    assert {"Key": "clearvest:managed-by", "Value": "clearvest-cicd"} in tags


def test_cd_role_gates_cloudfront_writes_on_ownership_tag():
    role = yaml.load(Path("infra/cicd-role.yaml").read_text(), Loader=_CfnLoader)
    stmts = role["Resources"]["DeployRole"]["Properties"]["Policies"][0]["PolicyDocument"]["Statement"]
    writes = {"cloudfront:UpdateDistribution", "cloudfront:DeleteDistribution", "cloudfront:UntagResource"}
    for st in stmts:
        actions = st["Action"] if isinstance(st["Action"], list) else [st["Action"]]
        if writes & set(actions):
            cond = st.get("Condition", {}).get("StringEquals", {})
            assert cond.get("aws:ResourceTag/clearvest:managed-by") == "clearvest-cicd", st["Sid"]


def test_refresh_queue_visibility_and_leases_cover_worker_deadline():
    from market import history_refresh as refresh

    res = load()["Resources"]
    worker = res["MarketRefreshFn"]["Properties"]
    queue = res["MarketRefreshQueue"]["Properties"]
    event = worker["Events"]["Refresh"]["Properties"]
    assert queue["VisibilityTimeout"] >= 6 * worker["Timeout"]
    assert refresh.WORK_SECONDS > worker["Timeout"]
    assert refresh.JOB_SECONDS > queue["MessageRetentionPeriod"]
    assert queue["RedrivePolicy"]["maxReceiveCount"] == refresh.MAX_RECEIVES
    assert event["BatchSize"] == 1
    assert event["FunctionResponseTypes"] == ["ReportBatchItemFailures"]
    # Concurrency is bounded by the event source, not reserved concurrency: the account's Lambda
    # limit is 10 and Lambda keeps 10 unreserved, so any reservation fails the deploy.
    assert "ReservedConcurrentExecutions" not in worker
    assert 1 <= event["ScalingConfig"]["MaximumConcurrency"] <= 2
    assert queue["SqsManagedSseEnabled"] is True
    assert res["MarketRefreshDeadLetterQueue"]["Properties"]["MessageRetentionPeriod"] > queue["MessageRetentionPeriod"]


def test_refresh_worker_permissions_exclude_user_data_and_unrelated_services():
    res = load()["Resources"]
    policies = res["MarketRefreshFn"]["Properties"]["Policies"]
    stmts = policies[0]["Statement"]
    assert stmts[0]["Condition"]["ForAllValues:StringLike"]["dynamodb:LeadingKeys"] == [
        "CACHE#history", "REFRESH#history#*",
    ]
    text = yaml.dump(policies)
    assert "DynamoDBCrudPolicy" not in text
    for forbidden in ("PlaidSecretParam", "bedrock:", "s3:", "sqs:SendMessage"):
        assert forbidden not in text
    assert {"SQSPollerPolicy": {"QueueName": "MarketRefreshQueue.QueueName"}} in policies
    assert {"SQSSendMessagePolicy": {"QueueName": "MarketRefreshQueue.QueueName"}} in res["MarketFn"]["Properties"]["Policies"]


def test_deploy_role_restricts_mapping_mutations_to_refresh_worker():
    doc = yaml.load(Path("infra/cicd-role.yaml").read_text(), Loader=_CfnLoader)
    statements = doc["Resources"]["DeployRole"]["Properties"]["Policies"][0]["PolicyDocument"]["Statement"]
    for stmt in statements:
        if stmt["Sid"] in ("AppRefreshMappingCreate", "AppRefreshMappings"):
            assert stmt["Condition"]["ArnLike"]["lambda:FunctionArn"].endswith(":function:${AppStackName}-MarketRefreshFn-*")


def test_advisor_guardrail_version_and_model_permission_are_bound_together():
    resources = load()["Resources"]
    assert resources["AdvisorGuardrail"]["Type"] == "AWS::Bedrock::Guardrail"
    assert resources["AdvisorGuardrailVersion"]["Type"] == "AWS::Bedrock::GuardrailVersion"
    topics = resources["AdvisorGuardrail"]["Properties"]["TopicPolicyConfig"]["TopicsConfig"]
    assert {t["Name"] for t in topics} == {"SpecificTradingRecommendations", "GuaranteedInvestmentReturns", "IllegalFinancialConduct"}
    assert all(t.get("InputEnabled", True) is False for t in topics[:2])  # allow educational reframing
    for name in ["AdvisorFn", "VoiceFn"]:
        props = resources[name]["Properties"]
        env = props["Environment"]["Variables"]
        assert env["ADVISOR_GUARDRAIL_VERSION"] == "AdvisorGuardrailVersion.Version"
        assert env["BEDROCK_MAX_ATTEMPTS"] == "1"
        statements = [s for p in props["Policies"] if "Statement" in p for s in p["Statement"]]
        invoke = next(s for s in statements if s["Action"] == "bedrock:InvokeModel")
        # Demo switch: guardrails are off, so inference must not require a guardrail.
        assert env["GUARDRAILS_ENABLED"] == "false"
        assert "Condition" not in invoke
        apply = next(s for s in statements if s["Action"] == "bedrock:ApplyGuardrail")
        assert "*" not in str(apply["Resource"])
    assert "GROUNDING_GUARDRAIL_ID" not in resources["VoiceFn"]["Properties"]["Environment"]["Variables"]
    grounding = resources["PortfolioGroundingGuardrail"]["Properties"]["ContextualGroundingPolicyConfig"]["FiltersConfig"]
    assert {f["Type"] for f in grounding} == {"GROUNDING", "RELEVANCE"}


# Bedrock Guardrail limits. CloudFormation's schema allows topic definitions up to 1000 chars
# (the Standard tier), but a guardrail without TopicsTierConfig runs on the Classic tier, which
# rejects definitions over 200 chars at CREATE time. cfn-lint and sam validate can't catch it;
# the #54 deploy failed on exactly this. Every other limit below also comes from the resource schema.
GUARDRAIL_NAME = re.compile(r"^[0-9a-zA-Z_-]{1,50}$")
TOPIC_NAME = re.compile(r"^[0-9a-zA-Z_ !?.-]{1,100}$")


def _guardrails():
    return {k: v["Properties"] for k, v in load()["Resources"].items() if v["Type"] == "AWS::Bedrock::Guardrail"}


def test_guardrails_fit_bedrock_limits():
    guardrails = _guardrails()
    assert guardrails, "expected at least one AWS::Bedrock::Guardrail"
    for name, props in guardrails.items():
        assert GUARDRAIL_NAME.match(props["Name"]), name
        assert 1 <= len(props.get("Description", "x")) <= 200, name
        for field in ("BlockedInputMessaging", "BlockedOutputsMessaging"):
            assert 1 <= len(props[field]) <= 500, f"{name}.{field}"
        topics = props.get("TopicPolicyConfig", {})
        tier = (topics.get("TopicsTierConfig") or {}).get("TierName", "CLASSIC")
        max_definition = 1000 if tier == "STANDARD" else 200
        for topic in topics.get("TopicsConfig", []):
            label = f"{name}.{topic['Name']}"
            assert TOPIC_NAME.match(topic["Name"]), label
            assert 1 <= len(topic["Definition"]) <= max_definition, f"{label}: definition is {len(topic['Definition'])} chars (max {max_definition} on {tier})"
            examples = topic.get("Examples", [])
            assert len(examples) <= 5, f"{label}: {len(examples)} examples (max 5)"
            assert all(1 <= len(e) <= 100 for e in examples), f"{label}: an example is over 100 chars"
        for word in (props.get("WordPolicyConfig") or {}).get("WordsConfig", []):
            assert 1 <= len(word["Text"]) <= 100, f"{name}: word over 100 chars"
        for f in (props.get("ContextualGroundingPolicyConfig") or {}).get("FiltersConfig", []):
            assert 0 <= f["Threshold"] < 1, f"{name}: grounding threshold must be in [0, 1)"
