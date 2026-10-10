"""Is this device online? Probed on the server, because phones on its local Wi-Fi can't tell."""
import os
import time

import requests

PROBE = "https://generativelanguage.googleapis.com/"  # same host the Gemini path needs
TTL_S = 20
_state = {"at": 0.0, "internet": True}


def internet() -> bool:
    if os.getenv("HUB_OFFLINE") == "1":  # rehearsal: behave as if the internet were down (offline rehearsal)
        return False
    if time.monotonic() - _state["at"] < TTL_S:
        return _state["internet"]
    try:
        requests.head(PROBE, timeout=2)
        up = True
    except requests.RequestException:
        up = False
    _state.update(at=time.monotonic(), internet=up)
    return up


def mark_down():
    """Called when a live Gemini call fails, so the next request goes straight to local Gemma."""
    _state.update(at=time.monotonic(), internet=False)
