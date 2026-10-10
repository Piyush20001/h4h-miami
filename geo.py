"""Deterministic geo lookups: evacuation zone and nearest shelters (stdlib only)."""
import json
import math
from pathlib import Path

_DATA = Path(__file__).resolve().parent / "data"

with open(_DATA / "zones.geojson", encoding="utf-8") as f:
    _ZONES = json.load(f)
with open(_DATA / "shelters.geojson", encoding="utf-8") as f:
    _SHELTERS = json.load(f)

try:
    with open(_DATA / "special_needs_shelters.geojson", encoding="utf-8") as f:
        _SPECIAL = json.load(f)
except (OSError, ValueError):
    _SPECIAL = {"features": []}

ZONES_SOURCE = _ZONES.get("source", "")
SHELTERS_SOURCE = _SHELTERS.get("source", "")
SPECIAL_NEEDS_SOURCE = _SPECIAL.get("source", "")
SAMPLE_DATA = bool(_SHELTERS.get("sample_data", False))


def _in_ring(x, y, ring):
    """Ray casting; ring is a list of [lng, lat]."""
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _in_polygon(x, y, rings):
    """rings[0] is the outer ring; the rest are holes."""
    return _in_ring(x, y, rings[0]) and not any(_in_ring(x, y, h) for h in rings[1:])


def get_zone(lat, lng):
    """Return storm surge planning zone letter "A".."E", or None if not in a zone."""
    for feat in _ZONES["features"]:
        geom = feat["geometry"]
        polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
        if any(_in_polygon(lng, lat, rings) for rings in polys):
            return feat["properties"]["zone"]
    return None


def _haversine_mi(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 3958.7613 * math.asin(math.sqrt(a))


def find_shelters(lat, lng, pet=False, limit=3):
    """Nearest shelters by straight-line distance. pet=True lists confirmed pet-friendly first,
    then the nearest with unknown pet rules ("pets not confirmed"); known no-pet shelters are dropped."""
    rows = []
    for feat in _SHELTERS["features"]:
        p = feat["properties"]
        if pet and p.get("pet_friendly") is False:
            continue
        s_lng, s_lat = feat["geometry"]["coordinates"]
        rows.append((_haversine_mi(lat, lng, s_lat, s_lng), p, s_lat, s_lng))
    rows.sort(key=lambda r: r[0])
    if pet:  # stable: confirmed pet-friendly first, distance order kept within each group
        rows.sort(key=lambda r: r[1].get("pet_friendly") is not True)
    return [
        {
            "name": p["name"],
            "address": p["address"],
            "city": p["city"],
            "lat": s_lat,
            "lng": s_lng,
            "distance_mi": round(d, 1),
            "pet_friendly": p.get("pet_friendly"),
        }
        for d, p, s_lat, s_lng in rows[:limit]
    ]


def find_special_needs(lat, lng, limit=1):
    """Nearest FDEM special-needs risk shelters (registration required). [] if no data."""
    rows = []
    for feat in _SPECIAL.get("features", []):
        p = feat["properties"]
        s_lng, s_lat = feat["geometry"]["coordinates"]
        rows.append((_haversine_mi(lat, lng, s_lat, s_lng), p, s_lat, s_lng))
    rows.sort(key=lambda r: r[0])
    return [
        {
            "name": p["name"],
            "address": p["address"],
            "city": p["city"],
            "lat": s_lat,
            "lng": s_lng,
            "distance_mi": round(d, 1),
            "pet_friendly": p.get("pet_friendly"),
            "special_needs": True,
        }
        for d, p, s_lat, s_lng in rows[:limit]
    ]
