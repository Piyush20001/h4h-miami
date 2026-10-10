"""StormCard Flask server: serves static/, POST /api/card, POST /api/ask."""
import gzip
import json
import queue
import threading

from flask import Flask, Response, jsonify, request, stream_with_context

import agent
import os
from pathlib import Path
import time

from dotenv import load_dotenv

load_dotenv()

import geo
import llm
import prompts_ask
import prompts_card
import status
import storms
import route

app = Flask(__name__, static_folder="static", static_url_path="")


@app.get("/")
def index():
    return app.send_static_file("index.html")


MIAMI_DADE = (25.13, 25.98, -80.88, -80.11)  # lat min/max, lng min/max (county bounding box)


class OutsideArea(ValueError):
    pass


class BadInput(ValueError):
    pass


@app.errorhandler(BadInput)
def _bad_input(_e):
    return jsonify(error="lat and lng are required numbers"), 400


def _facts(body):
    try:
        lat, lng = float(body["lat"]), float(body["lng"])
    except (KeyError, TypeError, ValueError):
        raise BadInput()
    if not (MIAMI_DADE[0] <= lat <= MIAMI_DADE[1] and MIAMI_DADE[2] <= lng <= MIAMI_DADE[3]):
        raise OutsideArea()
    flags = body.get("flags") or {}
    facts = {"zone": geo.get_zone(lat, lng), "lang": body.get("lang", "kre"), "flags": flags,
             "shelters": geo.find_shelters(lat, lng, pet=bool(flags.get("pet")), limit=3),
             "home": {"lat": lat, "lng": lng}}
    if flags.get("medical"):
        facts["special_needs_shelters"] = geo.find_special_needs(lat, lng)
    facts["bus_pickups"] = geo.find_bus_pickups(lat, lng)  # always: the card offers it collapsed when the car box is unticked
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
    """Storm surge zone polygons for the map overlay (cached on the server, works offline)."""
    return _geojson("zones.geojson")


_GZ = {}


def _geojson(name):
    """Static GeoJSON, gzipped once in memory (about 10x smaller over the tunnel), cached by the phone for a day."""
    if name not in _GZ:
        raw = (geo._DATA / name).read_bytes()
        _GZ[name] = (raw, gzip.compress(raw, 6))
    raw, gz = _GZ[name]
    if "gzip" in (request.headers.get("Accept-Encoding") or ""):
        resp = app.response_class(gz, mimetype="application/geo+json")
        resp.headers["Content-Encoding"] = "gzip"
    else:
        resp = app.response_class(raw, mimetype="application/geo+json")
    resp.headers["Cache-Control"] = "public, max-age=86400"
    resp.headers["Vary"] = "Accept-Encoding"
    return resp


@app.get("/api/route")
def walk_route():
    """Walking route along county street centerlines (offline). 404 when outside the street data."""
    try:
        a = [float(x) for x in request.args["from"].split(",")]
        b = [float(x) for x in request.args["to"].split(",")]
    except (KeyError, ValueError):
        return jsonify(error="from and to are lat,lng"), 400
    if len(a) != 2 or len(b) != 2:
        return jsonify(error="from and to are lat,lng"), 400
    r = route.walk(a[0], a[1], b[0], b[1])
    return (jsonify(r), 200) if r else (jsonify(error="no_route"), 404)


@app.get("/api/streets")
def streets():
    """Every street around the demo places, so the offline map shows the walking streets too."""
    return _geojson("streets.geojson")


@app.get("/api/roads")
def roads():
    """Major roads (Miami-Dade County layers) so the offline map has streets to read."""
    return _geojson("roads.geojson")


@app.get("/api/status")
def hub_status():
    """Connectivity mode for the UI: online (Gemini + Google map) or offline (local Gemma + chart). No user switch."""
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


def _ask_payload(body, on_step=None):
    """Shared by /api/ask and /api/ask/stream. Returns (payload, error_response)."""
    question = (body.get("question") or "").strip()
    lang = body.get("lang") if body.get("lang") in prompts_ask.IDK else "en"
    if not question:
        return None, (jsonify(error="question is required"), 400)
    message = None
    try:
        out = agent.run(question, body.get("card") or {}, lang, bool(body.get("force_offline")), on_step=on_step)
        answer, backend, trace, message = out["answer"], out["backend"], out["trace"], out.get("message")
    except Exception:  # any failure still answers safely
        answer, backend, trace = prompts_ask.IDK[lang], "facts_only", []
    print(f"[ask] lang={lang} backend={backend} steps={[s['tool'] for s in trace]} q={question[:60]!r} "
          f"a={answer.strip()[:120]!r}", flush=True)
    payload = {"answer": answer.strip(), "backend": backend, "trace": trace}
    if message:
        payload["message"] = message
    return payload, None


@app.post("/api/ask")
def ask():
    payload, err = _ask_payload(request.get_json(force=True) or {})
    return err if err else jsonify(**payload)


@app.post("/api/ask/stream")
def ask_stream():
    """Same input as /api/ask; NDJSON: one {"step": ...} line per agent step, then {"done": true, ...}."""
    body = request.get_json(force=True) or {}
    if not (body.get("question") or "").strip():
        return jsonify(error="question is required"), 400
    q = queue.Queue()

    def work():
        try:
            payload, _ = _ask_payload(body, on_step=lambda s: q.put({"step": s}))
        except Exception:
            payload = None
        q.put({"done": True, **(payload or {"answer": "", "backend": "facts_only", "trace": []})})

    threading.Thread(target=work, daemon=True).start()

    def gen():
        while True:
            item = q.get()
            yield json.dumps(item, ensure_ascii=False) + "\n"
            if item.get("done"):
                return

    return Response(stream_with_context(gen()), mimetype="application/x-ndjson",
                    headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})


def _warm_local_model():
    """Load local Gemma in the background at startup so the first offline answer is fast."""
    threading.Thread(target=llm.warm, daemon=True).start()


_warm_local_model()


if __name__ == "__main__":
    import sys
    if "--https" in sys.argv:
        # iPhone Safari only allows camera + compass + GPS on HTTPS: serve a self-signed copy on 8443
        import subprocess
        certs = Path(__file__).parent / "certs"
        certs.mkdir(exist_ok=True)
        crt, key = certs / "dev.crt", certs / "dev.key"
        if not crt.exists():
            subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "30",
                            "-subj", "/CN=stormcard.local", "-keyout", str(key), "-out", str(crt)], check=True)
        app.run(host="0.0.0.0", port=8443, ssl_context=(str(crt), str(key)))
    else:
        app.run(host="0.0.0.0", port=8000)
