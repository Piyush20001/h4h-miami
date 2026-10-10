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

## 2026-10-10 12:00 EDT: Stuti Agarwal (Card partner) → AI partner

**7. Data sources changed from ARCHI §10 (update §10 when you can)**
- Zones: `StormSurgePlanningZone_Multipart` (county layer, ZONEID already A–E). The ARCHI `Current_Hurricane_Evac` layer merges some small Zone A tiles into "no zone", so we didn't use it. CATEGORY mapping, for reference: 1→A … 5→E, 0 = no zone.
- Shelters: no county layer has rows, so we use the **Florida DEM statewide shelter inventory (as of 2021-08-31)**, filtered to Miami-Dade, 40 buildings. They are planning candidates only ("call 311 to confirm open"). Only 2 are marked pet-friendly; blank = unknown, never "yes".

**8. Little Haiti preset moved to 25.83, -80.189 (Zone C)**
The original 25.83, -80.195 falls in **no zone** (Little Haiti is mostly inland). The new point is still Little Haiti, near NE 2nd Ave. Hialeah is also no zone; Brickell is Zone B. Use the same coordinates for any demo script.

**9. CP1 status:** `POST /api/card` for Little Haiti returns Zone C + 3 shelters (stub card text until `llm.py` lands).

## 2026-10-10 12:02 EDT: Stuti Agarwal (Card partner) → AI partner

**10. Aligned with the PLAN.md contract.** Creole is now `lang: "kre"` everywhere (was "ht"), and shelters carry `distance_mi` (miles; was km). Shelters also include `city`, `lat`, `lng`. The item-1 example above is otherwise unchanged.

## 2026-10-10 12:16 EDT: Stuti Agarwal (Card partner) → AI partner

**11. 🚨 Ollama: send `"think": false` in `llm.py`.** On longer prompts, `gemma4:e4b` goes into thinking mode, spends all of `num_predict` on the hidden `thinking` field and returns **empty `content`**. With `"think": false` at the top level of the `/api/chat` body, the card prompt returns in 2–4 s on this laptop. This affects your Ask prompt too.
```python
{"model": "gemma4:e4b", "stream": False, "think": False, "messages": [...], "options": {"num_predict": 200}}
```

**12. Local e4b Creole check (card prompt):** after prompt tuning, Kreyòl/Spanish/English all pass validation offline. Before tuning, e4b wrote "Yo touye pou bèt" ("they kill for animals") for "pet-friendly". Kreyòl is usable but not perfect, so keep the plan: online 26B writes the card, and we judge offline Ask Creole at CP2.

**13. Ollama is installed and `gemma4:e4b` is pulled on Stuti's laptop** (`brew services start ollama`, port 11434).

## 2026-10-10 12:55 EDT: AI partner → Stuti (Card partner)

Thanks, your card slice is merged into branch **`feat/stormcard-mvp`**. On `card` I only ADDED new files (agent.py, llm.py, prompts_ask.py, guidance, special-needs data, new static files, tests, PRODUCT.md, design brief) and this note; none of your files were changed here. The integrated app (with the edits below to app.py/geo.py/prompts_card.py/card.js) lives on `feat/stormcard-mvp`.
- **Kept yours:** geo.py, prompts_card.py, data (FDEM shelters, StormSurgePlanningZone zones), your tests, your `/api/card` contract, the Little Haiti preset (25.83, -80.189).
- **Changed:** `pet=True` now lists confirmed pet-friendly first, then the nearest with unknown pet rules ("pets not confirmed"); known no-pets are dropped (your test updated). Placeholders the small model mangles (`**ZONE**`, `[SHELTER_1]`) are normalised; leftover placeholders fall back to the facts card.
- **Card copy:** where_to_go and what_to_bring are now always the code template; the model writes only what_this_means and what_to_do_now, only when Gemini answers. Offline (`force_offline`) or Ollama → facts-only card (the 2B local model's Kreyòl was not shippable and once said "you must evacuate"). Local Gemma is used for Ask offline.
- **New:** `/api/facts` (instant zone + shelters, no model), `agent.py` (Ask is a Gemma tool-calling agent with a visible trace), medical needs (FDEM special-needs shelters in `data/special_needs_shelters.geojson`, EEAP lines, checklist), new UI (static/*, styled per `.impeccable/surfaces/static-index-html.md`).
- **Gemini key:** your `AQ.` key works with Gemma 4 (tested 12:50). Put it in `.env` as `GEMINI_API_KEY=...` (gitignored). Gemini is slow today (11–40 s); default timeout is 30 s.
- **Offline model:** `gemma4:e2b-it-qat` (4.3 GB). My laptop has 8 GB RAM so e4b/e2b-mlx can't load. If yours has more, `OLLAMA_MODEL=gemma4:e4b` will give better Kreyòl for the offline demo.
- **Ask for you:** could you have a Kreyòl speaker (or you) check `static/i18n.js` and the CALL_311/OFFICIAL lines? And please review the README data-sources section against your data.
- **Re your #11–13:** `"think": false` is already in llm.py (found the same empty-content issue). Since your laptop runs `gemma4:e4b`, let's do the Wi-Fi-off demo moment on your laptop.
