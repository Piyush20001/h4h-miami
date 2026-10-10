import route


def test_walk_follows_streets_to_bus_stop():
    r = route.walk(25.83, -80.189, 25.8318876, -80.1921066)  # Little Haiti preset -> Magic City pickup
    assert r and r["miles"] > 0.2 and len(r["path"]) > 2
    assert r["steps"][0]["turn"] == "start" and r["steps"][0]["street"].startswith("NE ")


def test_walk_outside_street_data_is_none():
    assert route.walk(25.47, -80.48, 25.46, -80.47) is None  # Homestead: not in the bundled streets
