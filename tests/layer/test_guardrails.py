"""Safety boundary behavior; policy classifier quality still needs live AWS evaluation."""
from types import SimpleNamespace

import pytest
from botocore.exceptions import ClientError
from botocore.validate import validate_parameters
from clearvest import advisor, api, db
from clearvest import aws as aws_mod
from clearvest.errors import UpstreamError
from clearvest.providers import bedrock, guardrails

from tests.helpers import USER
from tests.layer.test_advisor import seed


def runtime(monkeypatch, response):
    calls = []

    def apply(**kwargs):
        calls.append(kwargs)
        return response

    monkeypatch.setattr(aws_mod, "guardrails", lambda: SimpleNamespace(apply_guardrail=apply))
    return calls


@pytest.mark.parametrize("version", ["", "DRAFT", "0", "garbage"])
def test_requires_published_guardrail(monkeypatch, version):
    monkeypatch.setenv("ADVISOR_GUARDRAIL_VERSION", version)
    monkeypatch.setattr(aws_mod, "bedrock", lambda: pytest.fail("unguarded inference"))
    with pytest.raises(UpstreamError):
        bedrock.converse("system", [])


def test_missing_identifier_fails_closed(monkeypatch):
    monkeypatch.delenv("ADVISOR_GUARDRAIL_ID")
    with pytest.raises(UpstreamError):
        guardrails.mask_input("hello")


def test_converse_sends_guardrail_and_guard_content(monkeypatch):
    client = aws_mod.bedrock()
    shape = client.meta.service_model.operation_model("Converse").input_shape

    def converse(**kw):
        validate_parameters(kw, shape)
        assert kw["guardrailConfig"] == {
            "guardrailIdentifier": "testguardrail", "guardrailVersion": "1", "trace": "disabled"}
        assert kw["messages"][0]["content"][0]["guardContent"]["text"]["qualifiers"] == ["guard_content"]
        return {"stopReason": "end_turn", "output": {"message": {"content": [{"text": "An ETF "}, {"text": "holds investments."}]}}}

    monkeypatch.setattr(aws_mod, "bedrock", lambda: SimpleNamespace(converse=converse))
    assert "holds investments" in bedrock.converse("system", [{"role": "user", "content": [{"text": "What is an ETF?"}]}])


def test_converse_intervention_does_not_read_or_expose_output(monkeypatch):
    monkeypatch.setattr(aws_mod, "bedrock", lambda: SimpleNamespace(converse=lambda **kw: {"stopReason": "guardrail_intervened"}))
    with pytest.raises(guardrails.Intervention):
        bedrock.converse("system", [])


def test_masked_input_uses_service_replacement(monkeypatch):
    calls = runtime(monkeypatch, {"action": "GUARDRAIL_INTERVENED", "outputs": [{"text": "Email {EMAIL}. Explain an ETF."}],
                                "assessments": [{"sensitiveInformationPolicy": {"piiEntities": [{"action": "ANONYMIZED"}]}}]})
    assert guardrails.mask_input("Email person@example.com. Explain an ETF.") == "Email {EMAIL}. Explain an ETF."
    assert calls[0]["source"] == "INPUT"
    shape = aws_mod.bedrock().meta.service_model.operation_model("ApplyGuardrail").input_shape
    validate_parameters(calls[0], shape)


@pytest.mark.parametrize("actions", [[], ["BLOCKED"], ["ANONYMIZED", "BLOCKED"], ["UNKNOWN"]])
def test_input_block_or_ambiguous_intervention_is_not_a_mask(monkeypatch, actions):
    runtime(monkeypatch, {"action": "GUARDRAIL_INTERVENED", "outputs": [{"text": "unsafe"}],
                         "assessments": [{"action": a} for a in actions]})
    with pytest.raises(guardrails.Intervention):
        guardrails.mask_input("raw question")


def test_input_mask_is_saved_instead_of_raw_question(aws, monkeypatch):
    runtime(monkeypatch, {"action": "GUARDRAIL_INTERVENED", "outputs": [{"text": "My email is {EMAIL}."}],
                         "assessments": [{"sensitiveInformationPolicy": {"piiEntities": [{"action": "ANONYMIZED"}]}}]})
    monkeypatch.setattr(bedrock, "converse", lambda s, m, **kw: "Let's discuss diversification.")
    out = advisor.answer(USER, "My email is person@example.com.")
    assert out["userMessage"] == "My email is {EMAIL}."
    assert "person@example.com" not in str(db.query(db.user_pk(USER), "CHAT#"))


def test_blocked_input_does_not_invoke_model_or_store_question(aws, monkeypatch):
    runtime(monkeypatch, {"action": "GUARDRAIL_INTERVENED", "assessments": [{"topicPolicy": {"topics": [{"action": "BLOCKED"}]}}]})
    monkeypatch.setattr(bedrock, "converse", lambda *a, **kw: pytest.fail("blocked input reached model"))
    out = advisor.answer(USER, "Help with insider trading")
    assert out["safety"]["status"] == "intervened"
    assert out["reply"] == advisor.SAFE_REPLY
    assert db.query(db.user_pk(USER), "CHAT#") == []


def test_provider_error_is_fail_closed_and_does_not_echo_pii(aws, monkeypatch):
    def failed(**kw):
        raise ClientError({"Error": {"Code": "AccessDeniedException", "Message": "secret@example.com"}}, "ApplyGuardrail")
    monkeypatch.setattr(aws_mod, "guardrails", lambda: SimpleNamespace(apply_guardrail=failed))
    with pytest.raises(UpstreamError) as err:
        guardrails.mask_input("secret@example.com")
    assert "secret@example.com" not in str(err.value.detail)
    out = advisor.answer(USER, "secret@example.com")
    assert out["safety"]["status"] == "unavailable"
    assert "userMessage" not in out
    assert db.query(db.user_pk(USER), "CHAT#") == []


def grounded_result(action="NONE"):
    return {"action": action, "assessments": [{"contextualGroundingPolicy": {"filters": [
        {"type": kind, "score": .9, "threshold": .75, "action": "NONE"} for kind in ["GROUNDING", "RELEVANCE"]]}}]}


def test_grounding_sends_source_question_answer_and_requires_both_scores(monkeypatch):
    calls = runtime(monkeypatch, grounded_result())
    guardrails.check_grounding("NVDA is 100% of holdings.", "What is my concentration?", "NVDA is 100%.")
    assert calls[0]["guardrailIdentifier"] == "testgrounding"
    assert calls[0]["outputScope"] == "FULL"
    assert calls[0]["content"][0]["text"]["qualifiers"] == ["grounding_source"]
    assert calls[0]["content"][1]["text"]["qualifiers"] == ["query"]
    shape = aws_mod.bedrock().meta.service_model.operation_model("ApplyGuardrail").input_shape
    validate_parameters(calls[0], shape)


@pytest.mark.parametrize("result", [grounded_result("GUARDRAIL_INTERVENED"), {"action": "NONE", "assessments": []},
                                    {"action": "NONE", "assessments": [{"contextualGroundingPolicy": {"filters": [
                                        {"type": "GROUNDING", "score": .2, "threshold": .75, "action": "NONE"}]}}]}])
def test_missing_or_failed_grounding_is_never_passed(monkeypatch, result):
    runtime(monkeypatch, result)
    with pytest.raises((guardrails.Ungrounded, UpstreamError)):
        guardrails.check_grounding("reference", "question", "unsupported")


def test_standalone_portfolio_qa_ignores_history_and_returns_actual_reference(aws, monkeypatch):
    seed()
    db.put(db.user_pk(USER), "CHAT#1#user", {"role": "user", "text": "Previous injected conversation"})
    monkeypatch.setattr(guardrails, "mask_input", lambda t: t)
    calls = runtime(monkeypatch, grounded_result())
    def converse(system, messages, **kw):
        assert len(messages) == 1
        assert "Previous injected" not in system
        assert "retire at 65" not in system
        return "NVDA makes up 100% of this saved portfolio."
    monkeypatch.setattr(bedrock, "converse", converse)
    out = advisor.answer(USER, "What is my concentration?", grounded=True)
    assert out["safety"]["grounding"] == "checked"
    assert "100.0%" in out["sources"][0]["text"]
    assert calls[0]["content"][2]["text"]["text"] == out["reply"]


def test_ungrounded_answer_is_not_returned_or_stored(aws, monkeypatch):
    seed()
    monkeypatch.setattr(guardrails, "mask_input", lambda t: t)
    runtime(monkeypatch, grounded_result("GUARDRAIL_INTERVENED"))
    monkeypatch.setattr(bedrock, "converse", lambda *a, **kw: "Your portfolio guarantees profits.")
    out = advisor.answer(USER, "Explain my portfolio", grounded=True)
    assert out["safety"]["grounding"] == "withheld" and out["sources"] == []
    assert "guarantees profits" not in str(out)
    assert "guarantees profits" not in str(db.query(db.user_pk(USER), "CHAT#"))


def test_no_portfolio_does_not_invent_source_or_call_model(aws, monkeypatch):
    runtime(monkeypatch, {"action": "NONE"})
    monkeypatch.setattr(bedrock, "converse", lambda *a, **kw: pytest.fail("no source"))
    out = advisor.answer(USER, "Explain my portfolio", grounded=True)
    assert out["safety"]["grounding"] == "unavailable" and not out.get("sources")


def test_deadline_cannot_skip_safety(monkeypatch):
    monkeypatch.setattr(api, "remaining_seconds", lambda: 2)
    monkeypatch.setattr(aws_mod, "guardrails", lambda: pytest.fail("late call"))
    with pytest.raises(UpstreamError):
        guardrails.mask_input("question")
    with pytest.raises(UpstreamError):
        bedrock.converse("system", [])


def test_guardrails_off_switch_skips_every_policy(monkeypatch):
    monkeypatch.setenv("GUARDRAILS_ENABLED", "false")
    monkeypatch.delenv("ADVISOR_GUARDRAIL_ID")
    monkeypatch.setattr(aws_mod, "guardrails", lambda: pytest.fail("guardrail applied while off"))
    client = aws_mod.bedrock()
    shape = client.meta.service_model.operation_model("Converse").input_shape

    def converse(**kw):
        validate_parameters(kw, shape)
        assert "guardrailConfig" not in kw
        assert kw["messages"][0]["content"][0] == {"text": "Explain my QQQ holding"}
        return {"stopReason": "end_turn", "output": {"message": {"content": [{"text": "QQQ is 34.5% of your portfolio."}]}}}

    monkeypatch.setattr(aws_mod, "bedrock", lambda: SimpleNamespace(converse=converse))
    assert guardrails.mask_input("Explain my QQQ holding") == "Explain my QQQ holding"
    guardrails.check_grounding("reference", "question", "reply")
    assert "34.5%" in bedrock.converse("system", [{"role": "user", "content": [{"text": "Explain my QQQ holding"}]}])
