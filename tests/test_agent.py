import json

import agent
import llm
import prompts_ask


def script(monkeypatch, replies):
    calls = []

    def fake(prompt, force_offline=False):
        calls.append(prompt)
        r = replies[min(len(calls) - 1, len(replies) - 1)]
        if isinstance(r, Exception):
            raise r
        return r, "ollama"

    monkeypatch.setattr(llm, "generate", fake)
    return calls


def test_tool_then_answer(monkeypatch):
    calls = script(monkeypatch, ['{"tool": "find_shelters", "args": {"pet": true}}',
                                 '{"answer": "Go to X."}'])
    out = agent.run("pets?", {}, "en", True)
    assert out["answer"] == "Go to X." and out["backend"] == "ollama"
    assert out["trace"][0]["tool"] == "find_shelters" and out["trace"][0]["args"] == {"pet": True}
    assert "RESULT:" in calls[1]


def test_parse_leniency():
    assert agent._parse('Sure!\n```json\n{"answer": "hi {x}"}\n```') == {"answer": "hi {x}"}
    assert agent._parse('junk {bad} then {"tool": "get_zone", "args": {}}')["tool"] == "get_zone"
    assert agent._parse("no json") is None


def test_max_steps_cap(monkeypatch):
    calls = script(monkeypatch, ['{"tool": "get_zone", "args": {}}'] * 3 + ['{"tool": "get_zone"}'] * 2
                   + ["plain text fallback"])
    out = agent.run("q", {}, "en", True)
    assert len([t for t in out["trace"] if t["tool"] == "get_zone"]) == agent.MAX_STEPS
    assert out["trace"][-1]["tool"] == "fallback"
    assert len(calls) == agent.MAX_STEPS + 2  # 4 steps + forced final + fallback call


def test_fallback_on_bad_json(monkeypatch):
    script(monkeypatch, ["I refuse to use JSON", "single call answer"])
    out = agent.run("q", {}, "en", True)
    assert out["answer"] == "single call answer" and out["trace"][0]["tool"] == "fallback"


def test_unknown_tool_and_bad_args(monkeypatch):
    script(monkeypatch, ['{"tool": "rm_rf"}', "ok"])
    assert agent.run("q", {}, "es", True)["trace"][0]["tool"] == "fallback"
    script(monkeypatch, ['{"tool": "get_zone", "args": {"bogus": 1}}', '{"answer": "A"}'])
    assert agent.run("q", {}, "es", True)["answer"] == "A"


def test_idk_when_model_down(monkeypatch):
    script(monkeypatch, [llm.LLMError("down")])
    out = agent.run("q", {}, "kre", True)
    assert out["answer"] == prompts_ask.IDK["kre"] and out["backend"] == "facts_only"


def test_idk_answer_passthrough(monkeypatch):
    script(monkeypatch, [json.dumps({"answer": prompts_ask.IDK["es"]})])
    assert agent.run("q", {}, "es", True)["answer"] == prompts_ask.IDK["es"]


def test_tools_deterministic():
    r, s = agent.lookup_guidance({}, query="dog pet vaccination")
    assert "Pets" in r["sections"][0]["title"] and r["sections"][0]["source"].startswith("http")
    r, _ = agent.find_shelters({}, pet=True)
    assert r["shelters"]
    r, _ = agent.packing_list({}, pet=True, medical=True)
    assert len(r["sections"]) >= 4
    r, _ = agent.evacuation_help({})
    assert "311" in json.dumps(r)
