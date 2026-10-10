"""StormCard Flask server: serves static/, POST /api/card, POST /api/ask."""
from flask import Flask, jsonify, request

import agent
import os
import time

from dotenv import load_dotenv

load_dotenv()

import geo
import llm
import prompts_ask
import prompts_card
import status
import storms

app = Flask(__name__, static_folder="static", static_url_path="")


@app.get("/")
def index():
    return app.send_static_file("index.html")


MIAMI_DADE = (25.13, 25.98, -80.88, -80.11)  # lat min/max, lng min/max (county bounding box)


class OutsideArea(ValueError):
    pass


def _facts(body):
    lat, lng = float(body["lat"]), float(body["lng"])
    if not (MIAMI_DADE[0] <= lat <= MIAMI_DADE[1] and MIAMI_DADE[2] <= lng <= MIAMI_DADE[3]):
        raise OutsideArea()
    flags = body.get("flags", {})
    facts = {"zone": geo.get_zone(lat, lng), "lang": body.get("lang", "kre"), "flags": flags,
             "shelters": geo.find_shelters(lat, lng, pet=bool(flags.get("pet")), limit=3),
             "home": {"lat": lat, "lng": lng}}
    if flags.get("medical"):
        facts["special_needs_shelters"] = geo.find_special_needs(lat, lng)
    if flags.get("no_car"):
        facts["bus_pickups"] = geo.find_bus_pickups(lat, lng)
    return facts


@app.errorhandler(OutsideArea)
def outside_area(_):
    return jsonify(error="outside_miami_dade",
                   message="StormCard only covers Miami-Dade County. Call 311 or your county emergency office."), 422


@app.post("/api/facts")
def facts_only():
    """Instant, model-free facts so the UI can draw the zone, chart and shelters right away."""
    facts = _facts(request.get_json(force=True))
    return jsonify(facts=facts, sources={"zones": geo.ZONES_SOURCE, "shelters": geo.SHELTERS_SOURCE},
                   sample_data=geo.SAMPLE_DATA)


@app.post("/api/card")
def card():
    body = request.get_json(force=True)
    facts = _facts(body)
    lang, zone, shelters = facts["lang"], facts["zone"], facts["shelters"]
    extra = {k: facts[k] for k in ("special_needs_shelters", "bus_pickups") if k in facts}
    t0 = time.monotonic()
    card_text, backend = prompts_card.build_card(facts, lang, bool(body.get("force_offline")))
    print(f"[card] lang={lang} zone={zone} backend={backend} {time.monotonic() - t0:.1f}s", flush=True)
    return jsonify(
        zone=zone,
        shelters=shelters,
        card_text=card_text,
        backend=backend,
        facts=facts,
        sources={"zones": geo.ZONES_SOURCE, "shelters": geo.SHELTERS_SOURCE},
        sample_data=geo.SAMPLE_DATA,
        **extra,
    )


@app.get("/api/zones")
def zones():
    """Storm surge zone polygons for the map overlay (cached on the hub, works offline)."""
    return app.response_class((geo._DATA / "zones.geojson").read_text(), mimetype="application/geo+json")


@app.get("/api/status")
def hub_status():
    """Hub mode for the UI: online (Gemini + Google map) or offline (local Gemma + chart). No user switch."""
    return jsonify(internet=status.internet())


@app.get("/api/config")
def config():
    """Browser-safe config. MAPS_API_KEY is a Maps-only key (never the Gemini key's name); empty = offline chart only."""
    online = status.internet()
    return jsonify(maps_api_key=os.getenv("MAPS_API_KEY", "") if online else "", internet=online)


@app.get("/api/storms")
def storm_card():
    """Nearest active Atlantic system from NHC (cached offline). Facts only; NHC owns the forecast."""
    lat = float(request.args.get("lat", 25.83))
    lng = float(request.args.get("lng", -80.189))
    return jsonify(storms.nearest(lat, lng))


def _card_as_text(card):
    """Flatten the /api/card response the UI sends back into plain text for the Ask prompt."""
    if isinstance(card, str):
        return card
    sections = (card.get("card_text") or {}).values()
    shelters = [f"- {s.get('name')}, {s.get('address')} ({s.get('distance_mi')} mi)"
                for s in card.get("shelters") or []]
    zone = card.get("zone")
    return "\n\n".join([f"Storm surge zone: {zone or 'none'}", *sections, "Shelters:", *shelters])


@app.post("/api/ask")
def ask():
    body = request.get_json(force=True) or {}
    question = (body.get("question") or "").strip()
    lang = body.get("lang") if body.get("lang") in prompts_ask.IDK else "en"
    if not question:
        return jsonify(error="question is required"), 400
    try:
        out = agent.run(question, body.get("card") or {}, lang, bool(body.get("force_offline")))
        answer, backend, trace = out["answer"], out["backend"], out["trace"]
    except Exception:  # any failure still answers safely
        answer, backend, trace = prompts_ask.IDK[lang], "facts_only", []
    print(f"[ask] lang={lang} backend={backend} steps={[s['tool'] for s in trace]} q={question[:60]!r} "
          f"a={answer.strip()[:120]!r}", flush=True)
    return jsonify(answer=answer.strip(), backend=backend, trace=trace)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
