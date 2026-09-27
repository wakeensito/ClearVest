"""Shared fixtures: fake AWS (moto) with the table, bucket and SSM params the stack creates."""

import os

import boto3
import pytest
from moto import mock_aws

os.environ.update(
    AWS_DEFAULT_REGION="us-east-1",
    AWS_ACCESS_KEY_ID="testing",
    AWS_SECRET_ACCESS_KEY="testing",
    TABLE_NAME="clearvest-test",
    AUDIO_BUCKET="clearvest-audio-test",
    POWERTOOLS_SERVICE_NAME="clearvest-test",
    APP_VERSION="test",
    MODEL_ID="us.amazon.nova-2-lite-v1:0",
    ADVISOR_GUARDRAIL_ID="testguardrail",
    ADVISOR_GUARDRAIL_VERSION="1",
    GROUNDING_GUARDRAIL_ID="testgrounding",
    GROUNDING_GUARDRAIL_VERSION="1",
    PLAID_ENV="sandbox",
    PLAID_CLIENT_ID_PARAM="clearvest-plaid-client-id",
    PLAID_SECRET_PARAM="clearvest-plaid-secret",
    FMP_KEY_PARAM="clearvest-fmp",
    ALPHAVANTAGE_KEY_PARAM="clearvest-alphavantage",
    SEC_USER_AGENT_PARAM="clearvest-sec-user-agent",
    ELEVENLABS_KEY_PARAM="clearvest-elevenlabs",
    ELEVENLABS_VOICE_ID="voice-test",
    ELEVENLABS_TTS_MODEL="eleven_flash_v2_5",
    ELEVENLABS_STT_MODEL="scribe_v1",
)

PARAMS = {
    "clearvest-plaid-client-id": "plaid-id",
    "clearvest-plaid-secret": "plaid-secret",
    "clearvest-fmp": "fmp-key",
    "clearvest-alphavantage": "av-key",
    "clearvest-sec-user-agent": "ClearVest test@example.com",
    "clearvest-elevenlabs": "el-key",
}


def _reset_caches():
    from clearvest import aws, config, http

    aws.reset()
    config.reset()
    http.reset()


@pytest.fixture
def aws():
    """Moto-backed AWS with the stack's table, bucket and SSM params."""
    with mock_aws(), pytest.MonkeyPatch.context() as env:
        _reset_caches()
        ddb = boto3.client("dynamodb")
        ddb.create_table(
            TableName=os.environ["TABLE_NAME"],
            KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}, {"AttributeName": "sk", "KeyType": "RANGE"}],
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        boto3.client("s3").create_bucket(Bucket=os.environ["AUDIO_BUCKET"])
        queue = boto3.client("sqs").create_queue(QueueName="market-refresh-test")["QueueUrl"]
        env.setenv("MARKET_REFRESH_QUEUE_URL", queue)
        ssm = boto3.client("ssm")
        for name, value in PARAMS.items():
            ssm.put_parameter(Name=name, Value=value, Type="SecureString")
        yield
        _reset_caches()
