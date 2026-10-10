import json

import agent
import llm
import prompts_ask


def script(monkeypatch, replies):
    calls = []

    def fake(prompt, force_offline=False, deadline=None):
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


def test_grounded_rejects_invented_facts():
    card = {"zone": "C", "shelters": [{"name": "Miami Northwestern HS"}]}
    assert agent._grounded("Go to Miami Northwestern HS and call 311.", card, [])
    assert not agent._grounded("Go to Miami Central High School.", card, [])
    assert not agent._grounded("You are in Zone A.", card, [])
    assert not agent._grounded("Call 305-555-1234 now.", card, [])


def test_unicode_words_match_accents():
    assert "bet" in agent._words("Èske abri a aksepte bèt?") and "bèt" in agent._words("bèt")
    assert agent.lookup_guidance({}, query="Èske abri a aksepte bèt?")[1].count("Pets")


def test_grounded_checks_every_named_place():
    card = {"zone": "C", "shelters": [{"name": "Miami Northwestern HS"}]}
    assert not agent._grounded("Go to Miami Northwestern HS or Miami Central HS.", card, [])
    assert agent._grounded("Go to Miami Northwestern HS.", card, [])


def test_deadline_stops_calls(monkeypatch):
    import llm, time
    try:
        llm.generate("hi", True, deadline=time.monotonic() - 1)
        assert False, "should raise"
    except llm.LLMError:
        pass


def test_pickup_named_by_code_when_model_omits_it():
    card = {"facts": {"home": {"lat": 25.83, "lng": -80.189}}}
    trace = [{"tool": "evacuation_help"}]
    out = agent._with_pickup("Rele 311.", card, "kre", trace)
    assert "Magic City Trailer Park" in out and out.startswith("Rele 311.")
    assert agent._with_pickup("Rele 311.", card, "kre", []) == "Rele 311."


CARD = {"facts": {"flags": {"pet": False, "no_car": False}, "home": {"lat": 25.83, "lng": -80.189}}}


def test_draft_message_zone_and_shelter():
    import geo
    res, _ = agent.draft_message(CARD, lang="en")
    msg = res["message"]
    z = geo.get_zone(25.83, -80.189)
    assert (f"zone {z}" in msg) if z else ("not in a surge zone" in msg)
    assert geo.find_shelters(25.83, -80.189, limit=1)[0]["name"] in msg
    assert "Call 311 to confirm the shelter is open." in msg
    assert "bus pickup" not in msg


def test_draft_message_pickup_only_when_no_car():
    car = {"facts": {"flags": {"no_car": True}, "home": {"lat": 25.83, "lng": -80.189}}}
    msg = agent.draft_message(car, lang="en")[0]["message"]
    assert "Nearest bus pickup" in msg and "only when evacuation is ordered" in msg
    assert "Pwen bis" in agent.draft_message(car, lang="kre")[0]["message"]


def test_family_routes_to_draft_message_and_on_step(monkeypatch):
    calls = script(monkeypatch, ['{"answer": "unused"}'])
    seen = []
    out = agent.run("Ekri fanmi m plan mwen", CARD, "kre", True, on_step=seen.append)
    assert calls == [] and out["trace"][0]["tool"] == "draft_message"
    assert out["message"] and seen == out["trace"]


def test_on_step_called_and_errors_ignored(monkeypatch):
    script(monkeypatch, ['{"tool": "get_zone", "args": {}}', '{"answer": "ok"}'])
    seen = []
    out = agent.run("zone?", {}, "en", True, on_step=seen.append)
    assert [s["tool"] for s in seen] == [t["tool"] for t in out["trace"]] and seen

    def boom(_):
        raise RuntimeError("x")
    script(monkeypatch, ['{"tool": "get_zone", "args": {}}', '{"answer": "ok"}'])
    assert agent.run("zone?", {}, "en", True, on_step=boom)["answer"] == "ok"


def test_idk_with_pickup_becomes_just_the_fact():
    card = {"facts": {"home": {"lat": 25.83, "lng": -80.189}}}
    out = agent._with_pickup(agent.IDK["en"], card, "en", [{"tool": "evacuation_help"}])
    assert out.startswith("Nearest evacuation bus pickup") and agent.IDK["en"] not in out


def test_latlng_reads_home_from_bare_facts():
    assert agent._latlng({"home": {"lat": 25.8005, "lng": -80.1993}}) == (25.8005, -80.1993)
