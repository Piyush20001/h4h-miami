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

## 2026-10-10 12:27 EDT: Stuti Agarwal (Card partner) → AI partner

**14. 🚨 Gemini API: turn thinking down in `llm.py`.** By default, `gemma-4-26b-a4b-it` thinks before answering. The card prompt took **140 s**, so with `GEMINI_TIMEOUT=6` every call would silently fall back to Ollama. Fix (tested, about 5 s):
```python
from google.genai import types
cfg = types.GenerateContentConfig(thinking_config=types.ThinkingConfig(thinking_level="minimal"), max_output_tokens=300)
client.models.generate_content(model=MODEL, contents=[prompt], config=cfg)
```
`thinking_budget=0` returns 400 "Thinking budget is not supported for this model". At about 5 s, `GEMINI_TIMEOUT=6` is too tight; suggest 12. `response.text` already excludes the thought parts.

**15. The card prompt is non-chat:** output is ONLY the `## SECTION` blocks, with no greeting or closing (verified online). Your Ask prompt likely wants the same "this is not a chat" rule.

## 2026-10-10 12:34 EDT: Stuti Agarwal (Card partner) → AI partner

Read your 12:55 merge notes, thanks. I'm now working on branch **`card-tuning`**, cut from `main` (= feat/stormcard-mvp).

**16. ~~I edited `llm.py`~~ Done on your side:** you already added `thinking_level="minimal"` on main, so I dropped my copy. Gemini now answers in 4–5 s; you can lower `GEMINI_TIMEOUT` to about 12.

**17. Prompt fixes, rebased onto your 2-section design (model writes only WHAT_THIS_MEANS + WHAT_TO_DO_NOW):** no evacuation-order overclaim, pet status "unknown" → "not confirmed, call 311", exact per-language leave-if-ordered sentence (no "evacuate", so `_ORDER` stops discarding good Spanish), localized `{{ZONE}}` fill ("Zòn Lanm Siklòn C"), Kreyòl word hints (kòd/kaj/abri), and "this is not a chat" output-only rule.

**18. Offline model test (card prompt, Kreyòl, on my laptop):**

| tag | disk | RAM | Kreyòl |
|---|---|---|---|
| gemma4:e4b (MLX) | 9.5 GB | 10 GB | best |
| **gemma4:e4b-it-qat** | 6.1 GB | 5.4 GB (ctx 2048) | usable, slightly below e4b |
| gemma4:e2b-it-qat | 4.3 GB | 3.6 GB | **unusable** ("kè"/heart for pet, nonsense words) |

So **e2b's Kreyòl isn't demo-safe**, for Ask either. My laptop has 24 GB RAM with e4b and e4b-it-qat pulled, so let's do the Wi-Fi-off moment here with `OLLAMA_MODEL=gemma4:e4b-it-qat` (or e4b). Use `num_predict` 300, because 200 cuts off Kreyòl (cards used 197–244 tokens). Use `keep_alive` "30m", and warm it up with one call before turning Wi-Fi off.

**19. In progress:** a per-language eval set (`evals/`). Kreyòl via `/api/card` currently passes validation only ~1 in 4 times online, and I'm finding out why.

## 2026-10-10 12:40 EDT: Stuti Agarwal (Card partner) → AI partner

**20. Home-screen app packaging (your `static/index.html`, `<head>` only):** I added `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title` and `<link rel="manifest">`, and pointed `apple-touch-icon` at `icons/apple-touch-icon.png`. New files: `static/manifest.webmanifest`, `static/icons/*`, `docs/MOBILE.md`. Phone note: "Use my location" won't work on the iPhone over plain http (Safari only allows geolocation on HTTPS), so use the presets.

**21. E2E (API, Little Haiti, pet + no car):** card online 4–5 s (gemini) in kre/es/en; offline card instant; Ask online with tool calls; Ask offline works. Two offline Ask issues:
- `gemma4:e4b-it-qat` Kreyòl produced nonsense ("Reyekonwi ke gen bèl bèl nòt…") and rambled on an off-topic question. Full `gemma4:e4b` is clearly better, so I'm using that on my laptop.
- Offline Spanish overclaimed: "Hay tres refugios… que aceptan mascotas" (only 2 confirmed). The Ask prompt may need "only say a shelter takes pets if pet_friendly is true".

**22. Work-laptop constraint (Stuti):** my laptop runs Microsoft Defender, so I'll keep Flask on `127.0.0.1` only and avoid new installs/listeners. The iPhone part of the demo needs a LAN listener, so let's run the phone demo from your laptop.

## 2026-10-10 13:19 EDT: Stuti Agarwal (Card partner) → AI partner

**23. Phone demo: free, no Apple Developer account, run from YOUR laptop.** Neither of us has a paid Apple Developer account, so no TestFlight. Instead we use the iPhone home-screen install (manifest, icons and iOS meta are already in `static/`). My laptop stays localhost-only because of Microsoft Defender, so please host it:

1. On your laptop:
   ```
   flask --app app run --host 0.0.0.0 --port 8000
   ipconfig getifaddr en0        # the laptop's IP, e.g. 10.88.2.23
   ```
2. iPhone on the same Wi-Fi: open Safari and go to `http://<that IP>:8000`.
3. Share → **Add to Home Screen** → Add. Open StormCard from the home screen (full screen, StormCard icon).

Notes:
- **Venue Wi-Fi often blocks phone→laptop.** If the page won't load, turn on the iPhone's **Personal Hotspot**, join it from your laptop, re-run `ipconfig getifaddr en0` (it'll be `172.20.10.x`) and use that IP on the phone.
- Use the **place presets**. "Use my location" doesn't work over plain http on iOS Safari.
- The phone needs your laptop to be reachable. The Wi-Fi-off moment stays on **my laptop** (localhost + Ollama `gemma4:e4b`).
- Do one 2-minute dry run before the demo.
- Native app (`ios/StormCard.xcodeproj`): without a paid account it can only be side-loaded via Xcode + free Apple ID over USB (10+ GB Xcode download, 7-day expiry). Not worth it today. On branch `mobile` I added `ITSAppUsesNonExemptEncryption = false` for whenever we do TestFlight later.
