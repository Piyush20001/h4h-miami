"""Live NHC storm feed for the home-screen card: facts only, cached for offline use."""
import json
import math
import time
from pathlib import Path

import requests

FEED = "https://www.nhc.noaa.gov/CurrentStorms.json"
CACHE = Path(__file__).resolve().parent / "data" / "storms_cache.json"
MAX_AGE_S = 600  # refetch at most every 10 minutes


def _miles(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * 3958.7613 * math.asin(math.sqrt(a))


def _bearing(lat1, lng1, lat2, lng2):
    p1, p2, dl = math.radians(lat1), math.radians(lat2), math.radians(lng2 - lng1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def _load():
    """Fresh NHC data when online; otherwise the last cached copy (marked stale)."""
    cached = json.loads(CACHE.read_text()) if CACHE.exists() else None
    if cached and time.time() - cached["fetched_at"] < MAX_AGE_S:
        return cached, False
    try:
        r = requests.get(FEED, timeout=5)
        r.raise_for_status()
        data = {"fetched_at": time.time(), "storms": r.json().get("activeStorms", [])}
        CACHE.write_text(json.dumps(data))
        return data, False
    except Exception:
        return cached, True


def nearest(lat, lng):
    data, stale = _load()
    if data is None:
        return {"available": False}
    atlantic = [s for s in data["storms"] if str(s.get("binNumber", "")).startswith("AT")]
    out = {"available": True, "stale": stale, "fetched_at": data["fetched_at"],
           "source": "https://www.nhc.noaa.gov/", "storm": None}
    best = None
    for s in atlantic:
        try:
            slat, slng = float(s["latitudeNumeric"]), float(s["longitudeNumeric"])
        except (KeyError, TypeError, ValueError):
            continue
        d = _miles(lat, lng, slat, slng)
        if best is None or d < best[0]:
            best = (d, s, slat, slng)
    if best:
        d, s, slat, slng = best
        out["storm"] = {"name": s.get("name"), "classification": s.get("classification"),
                        "intensity_kt": s.get("intensity"), "pressure_mb": s.get("pressure"),
                        "movement_dir_deg": s.get("movementDir"), "movement_kt": s.get("movementSpeed"),
                        "watches_warnings": bool(s.get("windWatchesWarnings") or s.get("stormSurgeWatchWarningGIS")),
                        "graphics_url": (s.get("forecastGraphics") or {}).get("url") or "https://www.nhc.noaa.gov/",
                        "last_update": s.get("lastUpdate"),
                        "distance_mi": round(d), "bearing_deg": round(_bearing(lat, lng, slat, slng)),
                        "advisory_url": (s.get("publicAdvisory") or {}).get("url") or "https://www.nhc.noaa.gov/"}
    return out
