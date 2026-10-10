"""StormCard Flask server: serves static/, POST /api/card, POST /api/ask."""
from flask import Flask, jsonify, request

import agent
import geo
import llm
import prompts_ask
import prompts_card

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
    extra = {k: facts[k] for k in ("special_needs_shelters",) if k in facts}
    card_text, backend = prompts_card.build_card(facts, lang, bool(body.get("force_offline")))
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
    return jsonify(answer=answer.strip(), backend=backend, trace=trace)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
