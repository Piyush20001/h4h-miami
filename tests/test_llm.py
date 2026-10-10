import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

import llm


def boom(*a, **k):
    raise RuntimeError("boom")


def test_gemini_success(monkeypatch):
    monkeypatch.setattr(llm, "_gemini_call", lambda p, t: "hello")
    monkeypatch.setattr(llm, "_ollama", boom)
    assert llm.generate("x") == ("hello", "gemini")


def test_gemini_error_falls_back(monkeypatch):
    monkeypatch.setattr(llm, "_gemini_call", boom)
    monkeypatch.setattr(llm, "_ollama", lambda p: "local")
    assert llm.generate("x") == ("local", "ollama")


def test_gemini_timeout_falls_back(monkeypatch):
    monkeypatch.setenv("GEMINI_TIMEOUT", "0.2")
    monkeypatch.setattr(llm, "_gemini_call", lambda p, t: time.sleep(2) or "late")
    monkeypatch.setattr(llm, "_ollama", lambda p: "local")
    t0 = time.time()
    assert llm.generate("x") == ("local", "ollama")
    assert time.time() - t0 < 1.5


def test_missing_key_falls_back(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(llm, "_ollama", lambda p: "local")
    assert llm.generate("x") == ("local", "ollama")


def test_force_offline_skips_gemini(monkeypatch):
    monkeypatch.setattr(llm, "_gemini_call", boom)
    monkeypatch.setattr(llm, "_ollama", lambda p: "local")
    assert llm.generate("x", force_offline=True) == ("local", "ollama")


def test_both_fail_raises_llmerror(monkeypatch):
    monkeypatch.setattr(llm, "_gemini_call", boom)
    monkeypatch.setattr(llm, "_ollama", boom)
    with pytest.raises(llm.LLMError):
        llm.generate("x")
    with pytest.raises(llm.LLMError):
        llm.generate("x", force_offline=True)


def test_ollama_parses_message_content(monkeypatch):
    seen = {}

    class R:
        def raise_for_status(self):
            pass

        def json(self):
            return {"message": {"content": " hi there "}}

    def fake_post(url, json=None, timeout=None):
        seen.update(url=url, json=json, timeout=timeout)
        return R()

    monkeypatch.setattr(llm.requests, "post", fake_post)
    monkeypatch.delenv("OLLAMA_MODEL", raising=False)
    assert llm._ollama("p") == "hi there"
    assert seen["url"].endswith("/api/chat")
    assert seen["json"]["model"] == "gemma4:e2b-it-qat"
    assert seen["json"]["stream"] is False
    assert seen["json"]["options"] == {"num_predict": 400, "num_ctx": 4096, "temperature": 0.2,
                                       "top_p": 0.9, "top_k": 40, "repeat_penalty": 1.1}
    assert seen["json"]["messages"] == [{"role": "user", "content": "p"}]


def test_ollama_rules_go_to_system_role(monkeypatch):
    seen = {}
    monkeypatch.setattr(llm, "_ollama_chat", lambda m, msgs, o, t: seen.update(msgs=msgs, o=o) or "ok")
    monkeypatch.setenv("OLLAMA_TEMPERATURE", "0.5")
    llm._ollama("RULES here\n\nCARD:\nzone C\n\nQUESTION:\nq")
    assert seen["msgs"] == [{"role": "system", "content": "RULES here"},
                            {"role": "user", "content": "CARD:\nzone C\n\nQUESTION:\nq"}]
    assert seen["o"]["temperature"] == 0.5


def test_warm_never_raises(monkeypatch):
    monkeypatch.setattr(llm.requests, "post", boom)
    assert llm.warm() is False
