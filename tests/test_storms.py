import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import storms  # noqa: E402

FEED = {"fetched_at": 0, "storms": [
    {"binNumber": "EP1", "name": "Simon", "latitudeNumeric": 17.4, "longitudeNumeric": -104.8},
    {"binNumber": "AT4", "name": "Isaias", "classification": "PTC", "intensity": "30", "pressure": "1006",
     "latitudeNumeric": 32.8, "longitudeNumeric": -86.8, "movementDir": 335, "movementSpeed": 10,
     "windWatchesWarnings": None, "lastUpdate": "2026-10-10T15:00:00.000Z"},
]}


def test_nearest_atlantic_only(monkeypatch):
    monkeypatch.setattr(storms, "_load", lambda: (FEED, False))
    out = storms.nearest(25.83, -80.189)
    assert out["storm"]["name"] == "Isaias" and 600 < out["storm"]["distance_mi"] < 650
    assert out["storm"]["watches_warnings"] is False and out["stale"] is False


def test_no_data_and_no_atlantic(monkeypatch):
    monkeypatch.setattr(storms, "_load", lambda: (None, True))
    assert storms.nearest(25.83, -80.189) == {"available": False}
    monkeypatch.setattr(storms, "_load", lambda: ({"fetched_at": 0, "storms": FEED["storms"][:1]}, True))
    out = storms.nearest(25.83, -80.189)
    assert out["storm"] is None and out["stale"] is True
