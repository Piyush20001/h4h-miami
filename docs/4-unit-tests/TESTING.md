# Testing Guidelines

## Test Framework

pytest (optional today; add to `requirements.txt` with the first test). Manual end-to-end checks are the real gate during the hackathon.

## Running Tests

```bash
.venv/bin/python -m py_compile *.py      # syntax check
.venv/bin/python -c "import app"         # app imports cleanly
.venv/bin/python -m pytest -q            # if tests/ exists
```

## Test Organization

`tests/test_<module>.py`, e.g. `tests/test_geo.py`, `tests/test_prompts_card.py`.

## Writing Tests

- Test pure functions first: `geo.get_zone`, `geo.find_shelters`, `prompts_card` slot filling and validation.
- Use the three presets (Little Haiti, Hialeah, Brickell) as fixtures.
- Never call the Gemini API or Ollama in unit tests; stub `llm.generate`.

## Manual Checks (required before submit)

1. Little Haiti preset → zone + 3 shelter candidates; pet filter works.
2. Cards in Kreyòl, Español, English read cleanly; facts in the right slots.
3. `curl` `/api/card` and `/api/ask` with `force_offline` false and true.
4. Wi-Fi off + Force offline → fresh Ask question answered by local Gemma.
5. Unsupported question → "I don't know. Call 311."
6. iPhone over Wi-Fi via Add to Home Screen loads and shows a card.

## Coverage Requirements

Not defined.
