"""StormCard Flask server: serves static/, POST /api/card, POST /api/ask."""
from flask import Flask, jsonify, request

import geo
import prompts_card

app = Flask(__name__, static_folder="static", static_url_path="")


@app.get("/")
def index():
    return app.send_static_file("index.html")


@app.post("/api/card")
def card():
    body = request.get_json(force=True)
    lat, lng = float(body["lat"]), float(body["lng"])
    lang = body.get("lang", "kre")
    flags = body.get("flags", {})
    zone = geo.get_zone(lat, lng)
    shelters = geo.find_shelters(lat, lng, pet=bool(flags.get("pet")), limit=3)
    facts = {"zone": zone, "lang": lang, "flags": flags, "shelters": shelters}
    card_text, backend = prompts_card.build_card(facts, lang, bool(body.get("force_offline")))
    return jsonify(
        zone=zone,
        shelters=shelters,
        card_text=card_text,
        backend=backend,
        facts=facts,
        sources={"zones": geo.ZONES_SOURCE, "shelters": geo.SHELTERS_SOURCE},
        sample_data=geo.SAMPLE_DATA,
    )


@app.post("/api/ask")
def ask():
    # Mock: owned by the AI partner (prompts_ask.py + llm.py).
    return jsonify(answer="I don't know. Call 311.", backend="stub")
