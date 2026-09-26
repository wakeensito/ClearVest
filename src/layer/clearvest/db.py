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


def query(
    pk: str, sk_prefix: str, limit: int | None = 50, newest_first: bool = False, consistent: bool = False
) -> list:
    """Items under pk whose sk starts with sk_prefix.

    With a limit, one page of at most `limit` items (e.g. the last N chat turns).
    limit=None reads every page: DynamoDB applies Limit per page, so a capped
    query silently truncates when callers need the full set.
    """
    kwargs = {
        "KeyConditionExpression": Key("pk").eq(pk) & Key("sk").begins_with(sk_prefix),
        "ScanIndexForward": not newest_first,
        "ConsistentRead": consistent,
    }
    if limit is not None:
        kwargs["Limit"] = limit
        return [json.loads(i["data"]) for i in aws.table().query(**kwargs).get("Items", [])]
    items = []
    while True:
        resp = aws.table().query(**kwargs)
        items.extend(json.loads(i["data"]) for i in resp.get("Items", []))
        if not resp.get("LastEvaluatedKey"):  # absent or {} both mean last page
            return items
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]


def delete_prefix(pk: str, sk_prefix: str) -> int:
    items: list = []
    start_key = None
    while True:
        kwargs: dict[str, Any] = {
            "KeyConditionExpression": Key("pk").eq(pk) & Key("sk").begins_with(sk_prefix),
            "ProjectionExpression": "pk, sk",
        }
        if start_key:
            kwargs["ExclusiveStartKey"] = start_key
        resp = aws.table().query(**kwargs)
        items.extend(resp.get("Items", []))
        start_key = resp.get("LastEvaluatedKey")
        if not start_key:
            break
    with aws.table().batch_writer() as batch:
        for i in items:
            batch.delete_item(Key={"pk": i["pk"], "sk": i["sk"]})
    return len(items)
