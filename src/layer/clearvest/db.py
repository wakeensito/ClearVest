"""Single-table DynamoDB access.

Every item is {pk, sk, data, ttl?}; `data` is a JSON string so callers never
see boto3's Decimal types.
"""

import json
from typing import Any

from boto3.dynamodb.conditions import Key

from clearvest import aws


def user_pk(user_id: str) -> str:
    return f"USER#{user_id}"


def put(pk: str, sk: str, data: Any, ttl: int | None = None) -> None:
    item = {"pk": pk, "sk": sk, "data": json.dumps(data)}
    if ttl is not None:
        item["ttl"] = int(ttl)
    aws.table().put_item(Item=item)


def get(pk: str, sk: str) -> Any | None:
    item = aws.table().get_item(Key={"pk": pk, "sk": sk}).get("Item")
    return json.loads(item["data"]) if item else None


def query(pk: str, sk_prefix: str, limit: int = 50, newest_first: bool = False) -> list:
    resp = aws.table().query(
        KeyConditionExpression=Key("pk").eq(pk) & Key("sk").begins_with(sk_prefix),
        ScanIndexForward=not newest_first,
        Limit=limit,
    )
    return [json.loads(i["data"]) for i in resp.get("Items", [])]


def delete_prefix(pk: str, sk_prefix: str) -> int:
    resp = aws.table().query(
        KeyConditionExpression=Key("pk").eq(pk) & Key("sk").begins_with(sk_prefix),
        ProjectionExpression="pk, sk",
    )
    items = resp.get("Items", [])
    with aws.table().batch_writer() as batch:
        for i in items:
            batch.delete_item(Key={"pk": i["pk"], "sk": i["sk"]})
    return len(items)
