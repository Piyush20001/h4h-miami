"""Gemma 4 engine: Gemini API first, local Ollama fallback.

generate() only ever raises LLMError. No client or key is touched at import time.
"""
import concurrent.futures
import os

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
        model=os.getenv("GEMMA_MODEL", "gemma-4-26b-a4b-it"), contents=prompt
    )
    text = (resp.text or "").strip()
    if not text:
        raise LLMError("empty Gemini response")
    return text


def _gemini(prompt: str) -> str:
    timeout = _float_env("GEMINI_TIMEOUT", 30)
    ex = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    try:
        fut = ex.submit(_gemini_call, prompt, timeout)
        return fut.result(timeout=timeout)  # authoritative deadline
    finally:
        ex.shutdown(wait=False)


def _ollama_chat(model: str, messages: list, options: dict, timeout: float) -> str:
    url = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
    r = requests.post(
        f"{url}/api/chat",
        json={"model": model, "messages": messages, "stream": False, "think": False, "options": options},
        timeout=timeout,
    )
    r.raise_for_status()
    return (r.json()["message"]["content"] or "").strip()


def _ollama(prompt: str) -> str:
    model = os.getenv("OLLAMA_MODEL", "gemma4:e2b-it-qat")
    text = _ollama_chat(
        model,
        [{"role": "user", "content": prompt}],
        {"num_predict": 400, "num_ctx": 4096},
        OLLAMA_TIMEOUT,
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


def generate(prompt: str, force_offline: bool = False) -> tuple[str, str]:
    """Return (text, "gemini" | "ollama"). Raises only LLMError."""
    gemini_err = None
    if not force_offline:
        try:
            return _gemini(prompt), "gemini"
        except BaseException as e:  # incl. timeouts; never leak
            if isinstance(e, (KeyboardInterrupt, SystemExit)):
                raise
            gemini_err = e
    try:
        return _ollama(prompt), "ollama"
    except Exception as e:
        raise LLMError(
            f"all backends failed (gemini: {type(gemini_err).__name__ if gemini_err else 'skipped'}; "
            f"ollama: {type(e).__name__})"
        ) from None
