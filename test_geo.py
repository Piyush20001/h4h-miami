"""Plain-assert checks for geo.py. Run: python3 test_geo.py"""
from geo import SAMPLE_DATA, SHELTERS_SOURCE, ZONES_SOURCE, find_shelters, get_zone

PRESETS = {
    "Little Haiti": (25.83, -80.195),
    "Hialeah": (25.8576, -80.2781),
    "Brickell": (25.7617, -80.1918),
}


def is_sorted(rows):
    d = [r["distance_km"] for r in rows]
    return d == sorted(d)


# Little Haiti: 3 shelters, sorted by distance, all fields present
lh = find_shelters(*PRESETS["Little Haiti"])
assert len(lh) == 3, lh
assert is_sorted(lh), lh
for r in lh:
    assert set(r) == {"name", "address", "city", "lat", "lng", "distance_km", "pet_friendly"}, r

# pet=True returns only confirmed pet-friendly shelters (source has few, so no length check)
pets = find_shelters(*PRESETS["Little Haiti"], pet=True)
assert pets, "expected at least one pet-friendly shelter"
assert all(r["pet_friendly"] is True for r in pets), pets
assert is_sorted(pets), pets

# Outside the county -> no zone
assert get_zone(28.5, -81.4) is None  # Orlando

# Verified against both the shipped layer and the ARCHI dissolved layer
assert get_zone(*PRESETS["Brickell"]) == "B"
assert get_zone(*PRESETS["Hialeah"]) is None

print(f"zones: {ZONES_SOURCE}\nshelters: {SHELTERS_SOURCE}\nsample_data: {SAMPLE_DATA}\n")
for name, (lat, lng) in PRESETS.items():
    print(f"{name} ({lat}, {lng}) zone={get_zone(lat, lng)}")
    for r in find_shelters(lat, lng):
        print(f"  {r['distance_km']:5.1f} km  {r['name']}, {r['address']}, {r['city']}  pet={r['pet_friendly']}")
print("\nPet-friendly near Little Haiti:")
for r in pets:
    print(f"  {r['distance_km']:5.1f} km  {r['name']}, {r['address']}, {r['city']}")
print("\nOK")
