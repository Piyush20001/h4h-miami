"""Plain-assert checks for geo.py. Run: python3 test_geo.py"""
from geo import SAMPLE_DATA, SHELTERS_SOURCE, ZONES_SOURCE, find_shelters, find_special_needs, get_zone

PRESETS = {
    "Little Haiti": (25.83, -80.195),
    "Hialeah": (25.8576, -80.2781),
    "Brickell": (25.7617, -80.1918),
}


def is_sorted(rows):
    d = [r["distance_mi"] for r in rows]
    return d == sorted(d)


# Little Haiti: 3 shelters, sorted by distance, all fields present
lh = find_shelters(*PRESETS["Little Haiti"])
assert len(lh) == 3, lh
assert is_sorted(lh), lh
for r in lh:
    assert set(r) == {"name", "address", "city", "lat", "lng", "distance_mi", "pet_friendly"}, r

# pet=True lists confirmed pet-friendly first, then unknown ("pets not confirmed"), never known no-pets
pets = find_shelters(*PRESETS["Little Haiti"], pet=True)
assert pets and pets[0]["pet_friendly"] is True, pets
assert all(r["pet_friendly"] is not False for r in pets), pets
confirmed = [r for r in pets if r["pet_friendly"] is True]
assert pets[:len(confirmed)] == confirmed and is_sorted(confirmed), pets

# Outside the county -> no zone
assert get_zone(28.5, -81.4) is None  # Orlando

# Verified against both the shipped layer and the ARCHI dissolved layer
assert get_zone(*PRESETS["Brickell"]) == "B"
assert get_zone(*PRESETS["Hialeah"]) is None

print(f"zones: {ZONES_SOURCE}\nshelters: {SHELTERS_SOURCE}\nsample_data: {SAMPLE_DATA}\n")
for name, (lat, lng) in PRESETS.items():
    print(f"{name} ({lat}, {lng}) zone={get_zone(lat, lng)}")
    for r in find_shelters(lat, lng):
        print(f"  {r['distance_mi']:5.1f} mi  {r['name']}, {r['address']}, {r['city']}  pet={r['pet_friendly']}")
print("\nPet-friendly near Little Haiti:")
for r in pets:
    print(f"  {r['distance_mi']:5.1f} mi  {r['name']}, {r['address']}, {r['city']}")
sn = find_special_needs(*PRESETS["Brickell"], limit=2)
assert len(sn) == 2 and all(r["special_needs"] for r in sn) and sn[0]["distance_mi"] <= sn[1]["distance_mi"]
assert set(sn[0]) == set(find_shelters(25.77, -80.19)[0]) | {"special_needs"}
print("\nOK")
