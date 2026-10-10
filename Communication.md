# Partner Communication

## 2026-10-10 11:48 EDT — Stuti Agarwal (Card partner) → AI partner

**1. `/api/card` response: `card_text` is an object, not a string**
```json
{
  "zone": "B" | null,
  "shelters": [{"name","address","city","lat","lng","distance_km","pet_friendly": true|false|null}],
  "card_text": {"what_this_means": "", "where_to_go": "", "what_to_bring": "", "what_to_do_now": ""},
  "backend": "gemini" | "ollama" | "stub" | "facts_only",
  "facts": {"zone", "lang", "flags", "shelters"},
  "sources": {"zones": "<url>", "shelters": "<url>"},
  "sample_data": true | false
}
```
Your `/api/ask` code receives this whole object as `card`.

**2. `llm.generate` contract I'm coding against**
`generate(prompt, force_offline) -> (text, backend)` per ARCHI §11. `prompts_card.py` does `from llm import generate` and uses a local stub until `llm.py` lands. Please keep this signature.

**3. `app.py` and `static/index.html` didn't exist, so I created minimal ones on branch `card`**
- `app.py`: `GET /`, `POST /api/card` (mine), and a mock `POST /api/ask` that returns `{"answer": "I don't know. Call 311.", "backend": "stub"}`. Replace only the `/api/ask` body with yours.
- `static/index.html`: has `<section id="intake">`, `<section id="card">`, `<section id="ask">` and loads `i18n.js`, `card.js`, `ask.js` in that order. Feel free to restyle; `card.js` uses these CSS classes: `.row .btn .on .primary .toggles .toggle .zone .none .note .shelters .tag .error .how .official .status`.

**4. Hooks for `ask.js`**
- `window.lastCard`: the full last `/api/card` response (also restored from localStorage). Send it as `card`.
- `window.forceOffline`: set this from your Force-offline toggle; `card.js` reads it on every submit.
- `window.cardState = {lang, preset, flags, forceOffline}`
- A `langchange` event fires on `window` when the language changes (`event.detail.lang`).

**5. Shelter data heads-up**
The ARCHI shelter source (311 MapServer layer 78) returns 0 rows right now, and so do the county's `EvacuationCenter_gdb` / `EvacuationCenterShelters_Open` layers (they probably only fill in when shelters are activated). If you already downloaded a populated copy, tell me. Otherwise I'm shipping the ARCHI §10 fallback: a small hand-verified set labeled "sample data".

**6. Gemini API key**
Do we have a shared `GEMINI_API_KEY`? I need it from ~12:15 to tune the Kreyòl/Español/English card.
