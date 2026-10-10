"""Gemma 4 engine: Gemini API first, local Ollama fallback.

generate() only ever raises LLMError. No client or key is touched at import time.
"""
import concurrent.futures
import os
import time

import requests
from dotenv import load_dotenv

load_dotenv()

OLLAMA_TIMEOUT = 60


class LLMError(Exception):
    pass


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return float(default)


def _gemini_call(prompt: str, timeout: float) -> str:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise LLMError("GEMINI_API_KEY missing")
    from google import genai
    from google.genai import types

    client = genai.Client(
        api_key=key,
        http_options=types.HttpOptions(timeout=int(timeout * 1000)),
    )
    resp = client.models.generate_content(
        model=os.getenv("GEMMA_MODEL", "gemma-4-26b-a4b-it"), contents=prompt,
        # Gemma 4 otherwise spends thousands of hidden thinking tokens (75 s vs 4 s for a card)
        config=types.GenerateContentConfig(thinking_config=types.ThinkingConfig(thinking_level="minimal")),
    )
    text = (resp.text or "").strip()
    if not text:
        raise LLMError("empty Gemini response")
    return text


def _gemini(prompt: str, cap: float | None = None) -> str:
    timeout = min(_float_env("GEMINI_TIMEOUT", 30), cap or float("inf"))
    ex = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    try:
        fut = ex.submit(_gemini_call, prompt, timeout)
        return fut.result(timeout=timeout)  # authoritative deadline
    finally:
        ex.shutdown(wait=False)


KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "2h")  # stay loaded: a cold load cost 30 s on the first offline answer


def _ollama_chat(model: str, messages: list, options: dict, timeout: float, fmt: str | None = None) -> str:
    url = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
    body = {"model": model, "messages": messages, "stream": False, "think": False,
            "keep_alive": KEEP_ALIVE, "options": options}
    if fmt:
        body["format"] = fmt  # constrained decoding: the small model cannot emit broken JSON
    r = requests.post(f"{url}/api/chat", json=body, timeout=timeout)
    r.raise_for_status()
    return (r.json()["message"]["content"] or "").strip()


def _ollama(prompt: str, cap: float | None = None) -> str:
    model = os.getenv("OLLAMA_MODEL", "gemma4:e2b-it-qat")
    wants_json = prompt.rstrip().endswith("YOUR JSON REPLY:")  # the Ask agent's step prompt
    text = _ollama_chat(
        model,
        [{"role": "user", "content": prompt}],
        {"num_predict": 400, "num_ctx": 4096, "temperature": 0.3},
        min(OLLAMA_TIMEOUT, cap or float("inf")),
        "json" if wants_json else None,
    )
    if not text:
        raise LLMError("empty Ollama response")
    return text


def warm() -> bool:
    """Load the Ollama model into memory with a 1-token request. Never raises."""
    try:
        _ollama_chat(
            os.getenv("OLLAMA_MODEL", "gemma4:e2b-it-qat"),
            [{"role": "user", "content": "hi"}],
            {"num_predict": 1, "num_ctx": 4096},
            OLLAMA_TIMEOUT,
        )
        return True
    except Exception:
        return False


def generate(prompt: str, force_offline: bool = False, deadline: float | None = None) -> tuple[str, str]:
    """Return (text, "gemini" | "ollama"). Raises only LLMError.
    deadline: optional time.monotonic() value; no backend call may run past it."""
    def left():
        if deadline is None:
            return None
        rem = deadline - time.monotonic()
        if rem <= 1:
            raise LLMError("request deadline reached")
        return rem

    import status  # local import keeps tests that stub backends independent of the network probe

    gemini_err = None
    if not force_offline and status.internet():
        try:
            cap = left()
            return (_gemini(prompt) if cap is None else _gemini(prompt, cap)), "gemini"
        except BaseException as e:  # incl. timeouts; never leak
            if isinstance(e, (KeyboardInterrupt, SystemExit)):
                raise
            gemini_err = e
            if not isinstance(e, LLMError):
                status.mark_down()
    try:
        cap = left()
        return (_ollama(prompt) if cap is None else _ollama(prompt, cap)), "ollama"
    except LLMError:
        raise
    except Exception as e:
        raise LLMError(
            f"all backends failed (gemini: {type(gemini_err).__name__ if gemini_err else 'skipped'}; "
            f"ollama: {type(e).__name__})"
        ) from None
