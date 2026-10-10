"""Walking routes on Miami-Dade street centerlines (data/streets.geojson), fully offline.

Streets only: no sidewalk or crossing data, so a route follows street centerlines and skips
expressways (county CLASS 0 and 1). Covers about 2 miles around the three demo places.
"""
import heapq
import json
import math
from functools import lru_cache
from pathlib import Path

_DATA = Path(__file__).parent / "data" / "streets.geojson"
_NO_WALK = {0, 1}  # expressways and highways
_SNAP_MAX_MI = 0.25


def _mi(a, b):
    r = math.pi / 180
    dlat, dlng = (b[1] - a[1]) * r, (b[0] - a[0]) * r
    x = math.sin(dlat / 2) ** 2 + math.cos(a[1] * r) * math.cos(b[1] * r) * math.sin(dlng / 2) ** 2
    return 2 * 3958.8 * math.asin(math.sqrt(x))


def _bearing(a, b):
    k = math.cos(a[1] * math.pi / 180)
    return (math.degrees(math.atan2((b[0] - a[0]) * k, b[1] - a[1])) + 360) % 360


@lru_cache(maxsize=1)
def _graph():
    adj = {}
    for f in json.loads(_DATA.read_text())["features"]:
        if f["properties"]["c"] in _NO_WALK:
            continue
        name = f["properties"]["n"]
        c = [tuple(p) for p in f["geometry"]["coordinates"]]
        for a, b in zip(c, c[1:]):
            d = _mi(a, b)
            adj.setdefault(a, []).append((b, d, name))
            adj.setdefault(b, []).append((a, d, name))
    return adj


def _snap(pt):
    best, bd = None, float("inf")
    for n in _graph():
        d = (n[0] - pt[0]) ** 2 + (n[1] - pt[1]) ** 2
        if d < bd:
            best, bd = n, d
    return best if best and _mi(best, pt) <= _SNAP_MAX_MI else None


def _name(n):
    """County names are upper case: NE 59TH ST -> NE 59th St."""
    out = []
    for w in (n or "").split():
        if w in {"N", "S", "E", "W", "NE", "NW", "SE", "SW"}:
            out.append(w)
        elif w[:1].isdigit():
            out.append(w.lower())
        else:
            out.append(w.capitalize())
    return " ".join(out)


def _turn(prev_b, next_b):
    d = (next_b - prev_b + 540) % 360 - 180
    if abs(d) < 30:
        return "straight"
    return "right" if d > 0 else "left"


def walk(from_lat, from_lng, to_lat, to_lng):
    """Shortest street route, or None when either end is outside the street data."""
    start, goal = _snap((from_lng, from_lat)), _snap((to_lng, to_lat))
    if not start or not goal:
        return None
    adj = _graph()
    dist, prev = {start: 0.0}, {}
    pq = [(_mi(start, goal), 0.0, start)]
    while pq:
        _, d, n = heapq.heappop(pq)
        if n == goal:
            break
        if d > dist.get(n, float("inf")):
            continue
        for m, w, name in adj.get(n, ()):
            nd = d + w
            if nd < dist.get(m, float("inf")):
                dist[m], prev[m] = nd, (n, name)
                heapq.heappush(pq, (nd + _mi(m, goal), nd, m))
    if goal not in dist:
        return None
    path, names, n = [goal], [], goal
    while n != start:
        n, name = prev[n]
        path.append(n)
        names.append(name)
    path.reverse()
    names.reverse()
    # steps: one per street name, with the turn taken onto it
    steps, i = [], 0
    while i < len(names):
        j = i
        while j + 1 < len(names) and names[j + 1] == names[i]:
            j += 1
        seg = sum(_mi(path[k], path[k + 1]) for k in range(i, j + 1))
        turn = "start" if not steps else _turn(_bearing(path[i - 1], path[i]), _bearing(path[i], path[i + 1]))
        if steps and turn == "straight" and steps[-1]["street"] == "":
            turn = "straight"
        steps.append({"street": _name(names[i]), "turn": turn, "miles": round(seg, 3),
                      "at": [path[i][1], path[i][0]]})
        i = j + 1
    # merge tiny unnamed or same-direction pieces so instructions stay few
    merged = []
    for s in steps:
        if merged and (s["miles"] < 0.02 or s["turn"] == "straight" and s["street"] == merged[-1]["street"]):
            merged[-1]["miles"] = round(merged[-1]["miles"] + s["miles"], 3)
            continue
        merged.append(s)
    return {"path": [[p[1], p[0]] for p in path], "miles": round(dist[goal], 2), "steps": merged,
            "source": "Miami-Dade County street centerlines"}
