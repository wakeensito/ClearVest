"""Validate payloads against docs/api/openapi.yaml (OpenAPI 3.1 == JSON Schema 2020-12)."""

from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

SPEC = yaml.safe_load(Path("docs/api/openapi.yaml").read_text())


def assert_matches(path: str, method: str, status: int, payload) -> None:
    resp = SPEC["paths"][path][method]["responses"][str(status)]
    schema = resp["content"]["application/json"]["schema"]
    # Root the schema in the spec so "#/components/..." refs resolve.
    wrapped = {"$schema": "https://json-schema.org/draft/2020-12/schema", "components": SPEC["components"], **schema}
    Draft202012Validator(wrapped).validate(payload)
