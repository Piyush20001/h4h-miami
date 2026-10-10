"""Plain-assert tests for prompts_card. Run: python3 test_prompts_card.py"""
import prompts_card as pc

SHELTERS = [
    {"name": "Miami Edison Senior High", "address": "6161 NW 5th Ct", "city": "Miami",
     "lat": 25.83, "lng": -80.2, "distance_mi": 1.2, "pet_friendly": True},
    {"name": "Toussaint L'Ouverture Elementary", "address": "120 NE 59th St", "city": "Miami",
     "lat": 25.82, "lng": -80.19, "distance_mi": 2.4, "pet_friendly": None},
    {"name": "Arcola Lake Park", "address": "1301 NW 83rd St", "city": "Miami",
     "lat": 25.85, "lng": -80.21, "distance_mi": 3.9, "pet_friendly": False},
]
FLAGS = {"pet": True, "no_car": True, "medical": False, "kids": False}
FOOTERS = {k: v["footer"] for k, v in pc.T.items()}


def facts(zone="B", shelters=SHELTERS, lang="kre"):
    return {"zone": zone, "lang": lang, "flags": FLAGS, "shelters": shelters}


def fake(text, backend="gemini"):
    pc.generate = lambda prompt, force_offline=False: (text, backend)


def check_card(card, lang):
    assert set(card) == set(pc.KEYS), card
    assert all(card[k].strip() for k in pc.KEYS), card
    assert "{{" not in "".join(card.values()), card
    assert card["what_to_do_now"].endswith(FOOTERS[lang]), card["what_to_do_now"]


GOOD = (
    "## WHAT_THIS_MEANS\nOu nan zòn {{ZONE}}. Lanmè ka monte vit.\n"
    "## WHERE_TO_GO\nAle nan {{SHELTER_1}} oswa {{SHELTER_2}}. Rele 311 pou konfime li ouvè.\n"
    "## WHAT_TO_BRING\n- Dlo\n- Manje pou 3 jou\n"
    "## WHAT_TO_DO_NOW\nPrepare sak ou kounye a.\n"
)
STUB = pc.generate


def test_stub_path():
    pc.generate = STUB
    card, backend = pc.build_card(facts(lang="en"), "en")
    if backend == "stub":  # only meaningful while llm.py is absent
        check_card(card, "en")
        assert "Miami Edison Senior High" in card["where_to_go"]
        assert "B" in card["what_this_means"]


def test_good_output_filled():
    fake(GOOD)
    card, backend = pc.build_card(facts(), "kre")
    assert backend == "gemini"
    check_card(card, "kre")
    assert "zòn B" in card["what_this_means"]
    assert "Miami Edison Senior High" in card["where_to_go"]
    assert "Toussaint L'Ouverture Elementary" in card["where_to_go"]


def test_bad_outputs_fall_back():
    bad = {
        "address": GOOD.replace("Lanmè ka monte vit.", "Ale 6161 NW 5th Ct."),
        "address2": GOOD.replace("Lanmè ka monte vit.", "Ale nan 1301 NW 83rd Street."),
        "zip": GOOD.replace("Lanmè ka monte vit.", "Miami 33127."),
        "zone_en": GOOD.replace("{{ZONE}}", "Zone B"),
        "zone_ht": GOOD.replace("zòn {{ZONE}}", "zòn C"),
        "zone_es": GOOD.replace("zòn {{ZONE}}", "zona d").replace("zona d", "Zona D"),
        "surge": GOOD.replace("zòn {{ZONE}}", "Surge Zone E"),
        "missing": GOOD.split("## WHAT_TO_DO_NOW")[0],
        "empty": GOOD.replace("Prepare sak ou kounye a.", ""),
        "phone": GOOD.replace("Rele 311", "Rele 305-555-1234"),
        "phone2": GOOD.replace("Rele 311", "Rele (305) 555 1234"),
        "unknown_ph": GOOD.replace("{{SHELTER_2}}", "{{ADDRESS_1}}"),
        "real_name": GOOD.replace("{{SHELTER_1}}", "Miami Edison Senior High"),
        "garbage": "I cannot help with that.",
        "none": None,
    }
    for name, text in bad.items():
        fake(text)
        card, backend = pc.build_card(facts(), "kre")
        assert backend == "facts_only", name
        check_card(card, "kre")


def test_exception_falls_back():
    def boom(prompt, force_offline=False):
        raise RuntimeError("ollama down")
    pc.generate = boom
    card, backend = pc.build_card(facts(), "es")
    assert backend == "facts_only"
    check_card(card, "es")


def test_zone_none():
    f = facts(zone=None)
    prompt = pc.build_prompt(f, "en")
    assert "\"in_evacuation_zone\": false" in prompt and "{{ZONE}}" not in prompt
    fake(GOOD.replace("Ou nan zòn {{ZONE}}.", "Ou pa nan yon zòn evakyasyon."))
    card, backend = pc.build_card(f, "kre")
    assert backend == "gemini"
    check_card(card, "kre")
    fake(GOOD)  # model used {{ZONE}} though there is no zone
    card, backend = pc.build_card(f, "kre")
    assert backend == "facts_only"
    assert card["what_this_means"] == pc.T["kre"]["nozone"]


def test_facts_only_all_langs():
    for lang in ("kre", "es", "en"):
        card = pc.facts_only_card(facts(lang=lang), lang)
        check_card(card, lang)
        for s in SHELTERS:
            assert s["name"] in card["where_to_go"]
        assert card["where_to_go"].count("311") >= 3
        assert pc.T[lang]["petbring"] in card["what_to_bring"]
        assert pc.T[lang]["nocar"] in card["what_to_do_now"]
    assert "Rele 311 pou konfime li ouvè." in pc.facts_only_card(facts(), "kre")["where_to_go"]
    empty = pc.facts_only_card(facts(shelters=[]), "en")
    assert empty["where_to_go"] == pc.T["en"]["noshelter"]


def test_one_shelter():
    one = facts(shelters=SHELTERS[:1])
    fake(GOOD.replace(" oswa {{SHELTER_2}}", ""))
    card, backend = pc.build_card(one, "kre")
    assert backend == "gemini"
    check_card(card, "kre")
    fake(GOOD)  # refers to {{SHELTER_2}}, which doesn't exist
    card, backend = pc.build_card(one, "kre")
    assert backend == "facts_only"
    check_card(card, "kre")


def test_prompt_hides_facts():
    p = pc.build_prompt(facts(), "kre")
    for s in SHELTERS:
        assert s["name"] not in p and s["address"] not in p
    assert '"zone": "{{ZONE}}"' in p and "Kreyòl" in p and "WHAT_TO_DO_NOW" in p


SN = [{"name": "Miami Edison HS", "address": "6161 NW 5th Ct", "city": "Miami", "lat": 25.83,
       "lng": -80.2, "distance_mi": 1.1, "pet_friendly": None, "special_needs": True}]


def test_medical_path():
    f = {"zone": "B", "lang": "kre", "flags": {"medical": True}, "shelters": SHELTERS,
         "special_needs_shelters": SN}
    for lang in ("kre", "es", "en"):
        m = pc.T[lang]["medical"]
        card = pc.facts_only_card(f, lang)
        n = card["what_to_do_now"]
        assert "EEAP" in n and "311" in n and "https://www.miamidade.gov/fire/eeap.asp" in n, n
        assert m["meds"] in n and m["power"] in n and "Miami Edison HS" in n, n
        assert n.endswith(FOOTERS[lang]), n
        # same lines are added on the model path
        fake(GOOD)
        card, backend = pc.build_card(f, lang)
        assert backend == "gemini" and m["eeap"] in card["what_to_do_now"], card
        assert card["what_to_do_now"].endswith(FOOTERS[lang])
    # no special-needs shelter data: no name line, EEAP still present
    f2 = dict(f, special_needs_shelters=[])
    n = pc.facts_only_card(f2, "en")["what_to_do_now"]
    assert "EEAP" in n and "special-needs shelter" not in n
    # not medical: nothing added
    assert "EEAP" not in pc.facts_only_card(facts(), "en")["what_to_do_now"]


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} passed")
    print("\n--- sample prompt ---\n" + pc.build_prompt(facts(), "kre"))
    pc.generate = STUB
    print("--- sample facts-only (ht) ---")
    for k, v in pc.facts_only_card(facts(), "kre").items():
        print(f"[{k}]\n{v}")


def test_invented_place_in_model_section_replaced(monkeypatch):
    import prompts_card as pc
    facts = {"zone": "C", "lang": "en", "flags": {}, "shelters": [{"name": "A", "address": "1 X St", "distance_mi": 1.0, "pet_friendly": None}]}
    raw = "## WHAT_THIS_MEANS\nGo to Miami Central High School now.\n## WHAT_TO_DO_NOW\nPack water. Call 311.\n"
    monkeypatch.setattr(pc, "generate", lambda p, f=False: (raw, "gemini"))
    card, backend = pc.build_card(facts, "en", False)
    assert "Miami Central" not in card["what_this_means"]


def test_invented_abbrev_place_replaced(monkeypatch):
    import prompts_card as pc
    facts = {"zone": "C", "lang": "en", "flags": {}, "shelters": []}
    raw = "## WHAT_THIS_MEANS\nGo to Miami Central HS now.\n## WHAT_TO_DO_NOW\nPack water.\n"
    monkeypatch.setattr(pc, "generate", lambda p, f=False: (raw, "gemini"))
    card, _ = pc.build_card(facts, "en", False)
    assert "Miami Central" not in card["what_this_means"]
