"""Card prompt, validation and slot filling. Facts by code, words by model (ARCHI §5)."""
import json
import re

try:
    from llm import generate
except ImportError:
    _STUB = (
        "## WHAT_THIS_MEANS\nYou live in zone {{ZONE}}. Water from the sea can come in fast.\n"
        "## WHERE_TO_GO\nThe closest place is {{SHELTER_1}}. Call 311 to confirm it is open.\n"
        "## WHAT_TO_BRING\n- Water and food for 3 days\n- Your medicines\n- Your papers\n"
        "## WHAT_TO_DO_NOW\nPack a bag today. Charge your phone."
    )

    def generate(prompt, force_offline=False):
        return _STUB, "stub"

KEYS = ["what_this_means", "where_to_go", "what_to_bring", "what_to_do_now"]
LANG_NAMES = {"kre": "Haitian Creole (Kreyòl)", "es": "Spanish", "en": "English"}
STYLE = {
    "kre": "Use standard Haitian Creole spelling (Kreyòl), not French.",
    "es": "Use simple Spanish. Address the reader as \"usted\".",
    "en": "Use plain, simple English.",
}

# ---- validation patterns (run on RAW model output, before slot filling) ----
_PLACEHOLDER = re.compile(r"\{\{([^}]*)\}\}")
_STREET = r"(?i:st|ave|street|avenue|blvd|boulevard|rd|road|ct|court|dr|drive|way|terrace|ter|pl|place|hwy|highway|lane|ln)"
_ADDRESS = re.compile(
    r"\b\d{1,6}(?:st|nd|rd|th)?\s+(?:[A-Z0-9][\w.]*\s+){0,3}" + _STREET + r"\b"  # 1250 NW 62nd St
    r"|(?i:\b(?:calle|avenida|ave|ri|lari|rue)\s+\d+)"                          # Calle 8, Ri 54
    r"|\b\d{5}\b"                                                               # zip code
)
# Keyword case-insensitive; letter must be uppercase so "zona a la que..." doesn't trip it.
_ZONE = re.compile(r"(?i:\b(?:surge\s+)?(?:zone|zona|zòn|zon))\s+[A-E]\b")
_PHONE = re.compile(r"\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{4}\b|\b\d{7,}\b")

# ---- facts-only templates ----
T = {
    "en": {
        "zone": "You are in Storm Surge Zone {z}. This is not the flood insurance zone. If officials order your zone to leave, go.",
        "nozone": "You are not in a storm surge evacuation zone. If your home is safe, you can stay home. Still get ready.",
        "shelters": "Shelters near you (for planning only):",
        "shelter": "- {name}: {d} mi{pet}. Call 311 to confirm it's open.",
        "noshelter": "We did not find a shelter near you. Call 311 to ask where to go.",
        "pet": {True: "pets OK", None: "ask 311 about pets", False: "no pets"},
        "bring": ["Water", "Food for 3 days", "Medicines", "Documents (ID, papers)", "Phone charger"],
        "petbring": "Pet food, leash and carrier",
        "nocar": "No car? Ask a neighbor, or call 311 for a ride to a shelter.",
        "now": "Pack your bag now. Charge your phone. Listen to local news.",
        "medical": {
            "eeap": "Medical needs: if you cannot leave on your own, register with Miami-Dade's Emergency and Evacuation Assistance Program (EEAP). Call 311 to ask for the application. Register early: it closes before an evacuation order. Info: https://www.miamidade.gov/fire/eeap.asp",
            "meds": "Bring 7 days of your medicine and a written list of your medications.",
            "power": "Plan for power for medical devices: charge them and pack chargers and backup batteries. If a machine needs electricity, ask EEAP about help.",
            "sn": "Nearest special-needs shelter: {name}. Register first. Call 311.",
        },
        "footer": "Follow official orders from Miami-Dade Emergency Management.",
    },
    "es": {
        "zone": "Usted está en la Zona de Marejada Ciclónica {z}. No es la zona del seguro de inundación. Si las autoridades ordenan evacuar su zona, váyase.",
        "nozone": "Usted no está en una zona de evacuación por marejada. Si su casa es segura, puede quedarse. Igual prepárese.",
        "shelters": "Refugios cerca de usted (solo para planear):",
        "shelter": "- {name}: a {d} millas{pet}. Llame al 311 para confirmar que está abierto.",
        "noshelter": "No encontramos un refugio cerca. Llame al 311 para saber adónde ir.",
        "pet": {True: "acepta mascotas", None: "pregunte al 311 por mascotas", False: "no acepta mascotas"},
        "bring": ["Agua", "Comida para 3 días", "Medicinas", "Documentos (identificación, papeles)", "Cargador de teléfono"],
        "petbring": "Comida, correa y transportadora para su mascota",
        "nocar": "¿No tiene carro? Pida ayuda a un vecino o llame al 311 para que lo lleven a un refugio.",
        "now": "Prepare su bolso ahora. Cargue su teléfono. Escuche las noticias locales.",
        "medical": {
            "eeap": "Necesidades médicas: si no puede salir por su cuenta, inscríbase en el Programa de Asistencia de Emergencia y Evacuación (EEAP) de Miami-Dade. Llame al 311 para pedir la solicitud. Inscríbase temprano: cierra antes de la orden de evacuación. Información: https://www.miamidade.gov/fire/eeap.asp",
            "meds": "Lleve medicinas para 7 días y una lista escrita de sus medicamentos.",
            "power": "Planee la energía para sus equipos médicos: cárguelos y lleve cargadores y baterías de repuesto. Si un equipo necesita electricidad, pregunte al EEAP por ayuda.",
            "sn": "Refugio para necesidades especiales más cercano: {name}. Inscríbase primero. Llame al 311.",
        },
        "footer": "Siga las órdenes oficiales de Manejo de Emergencias de Miami-Dade.",
    },
    "kre": {
        "zone": "Ou nan Zòn Evakyasyon {z} pou lanmè k ap monte. Sa a se pa zòn asirans inondasyon an. Si otorite yo bay lòd pou zòn ou an evakye, pati.",
        "nozone": "Ou pa nan yon zòn evakyasyon pou lanmè k ap monte. Si kay ou an an sekirite, ou ka rete lakay ou. Men, prepare w kanmenm.",
        "shelters": "Abri ki tou pre w (pou planifye sèlman):",
        "shelter": "- {name}: {d} mil{pet}. Rele 311 pou konfime li ouvè.",
        "noshelter": "Nou pa jwenn yon abri tou pre w. Rele 311 pou mande ki kote pou w ale.",
        "pet": {True: "yo aksepte bèt", None: "mande 311 pou bèt", False: "yo pa aksepte bèt"},
        "bring": ["Dlo", "Manje pou 3 jou", "Medikaman", "Papye enpòtan (ID, dokiman)", "Chajè telefòn"],
        "petbring": "Manje, kòd ak kaj pou bèt ou",
        "nocar": "Ou pa gen machin? Mande yon vwazen ede w, oswa rele 311 pou yo vin chèche w mennen w nan yon abri.",
        "now": "Prepare sak ou kounye a. Chaje telefòn ou. Koute nouvèl lokal yo.",
        "medical": {
            "eeap": "Bezwen medikal: si ou pa ka kite kay la poukont ou, enskri nan Pwogram Asistans pou Ijans ak Evakyasyon (EEAP) Miami-Dade la. Rele 311 pou mande fòm nan. Enskri bonè: enskripsyon an fèmen anvan lòd evakyasyon an. Plis enfòmasyon: https://www.miamidade.gov/fire/eeap.asp",
            "meds": "Pote medikaman pou 7 jou ak yon lis medikaman ou ekri sou papye.",
            "power": "Prepare kouran pou aparèy medikal ou yo: chaje yo, epi pote chajè ak pil adisyonèl. Si yon machin bezwen kouran, mande EEAP ede w.",
            "sn": "Abri ki pi pre pou moun ki gen bezwen espesyal: {name}. Enskri anvan. Rele 311.",
        },
        "footer": "Swiv lòd ofisyèl Jesyon Ijans Miami-Dade yo.",
    },
}


def _lang(lang):
    return lang if lang in T else "en"


def build_prompt(facts, lang):
    lang = _lang(lang)
    flags = facts.get("flags") or {}
    shelters = facts.get("shelters") or []
    model_facts = {
        "zone": "{{ZONE}}" if facts.get("zone") else None,
        "in_evacuation_zone": bool(facts.get("zone")),
        "flags": flags,
        "shelters": [
            {"name": "{{SHELTER_%d}}" % (i + 1), "distance_mi": s.get("distance_mi"),
             "pet_friendly": s.get("pet_friendly")}
            for i, s in enumerate(shelters[:3])
        ],
    }
    notes = []
    if not facts.get("zone"):
        notes.append("Not in a surge zone: say they can stay home if it is safe, still prepare, and follow official orders.")
    if flags.get("no_car"):
        notes.append("No car: tell them to ask a neighbor or call 311 for a ride to a shelter.")
    if flags.get("medical"):
        notes.append("Medical needs: bring medicines; call 311 to ask about special-needs shelters.")
    if flags.get("kids"):
        notes.append("Kids: bring things for the children.")
    if flags.get("pet"):
        notes.append("Pet: bring pet food, leash, carrier, vaccine records. Shelters with pet_friendly true take pets; for pet_friendly null say pets are not confirmed and to call 311 first.")
    return (
        f"Write a hurricane action card in {LANG_NAMES[lang]}. {STYLE[lang]}\n"
        "Facts (JSON):\n" + json.dumps(model_facts, ensure_ascii=False) + "\n"
        "Rules:\n"
        "- 6th-grade reading level. Short sentences. 80-120 words total.\n"
        + ("- Refer to the zone ONLY as {{ZONE}}.\n" if facts.get("zone") else "")
        + "- Refer to shelters ONLY as {{SHELTER_1}}, {{SHELTER_2}}, {{SHELTER_3}} (only those listed).\n"
        "- Never write addresses, zone letters, shelter names, or phone numbers. The only number allowed is 311.\n"
        "- Shelters are planning candidates: say to call 311 to confirm it is open.\n"
        "- Do not talk about hurricane categories.\n"
        + "".join(f"- {n}\n" for n in notes)
        + "Output exactly these four headers in English, each followed by the text in "
        f"{LANG_NAMES[lang]}:\n"
        "## WHAT_THIS_MEANS\n## WHERE_TO_GO\n## WHAT_TO_BRING\n## WHAT_TO_DO_NOW\n"
    )


def _parse(raw):
    """Split raw output into the 4 sections; None if any is missing or empty."""
    parts = re.split(r"^\s*#{1,3}\s*(WHAT_THIS_MEANS|WHERE_TO_GO|WHAT_TO_BRING|WHAT_TO_DO_NOW)\s*:?\s*$",
                     raw or "", flags=re.M)
    sections = {}
    for header, body in zip(parts[1::2], parts[2::2]):
        sections.setdefault(header.lower(), body.strip())
    if any(not sections.get(k) for k in KEYS):
        return None
    return sections


def _valid(raw, facts):
    shelters = facts.get("shelters") or []
    allowed = {"SHELTER_%d" % (i + 1) for i in range(min(3, len(shelters)))}
    if facts.get("zone"):
        allowed.add("ZONE")
    if any(p.strip() not in allowed for p in _PLACEHOLDER.findall(raw)):
        return False
    if _ADDRESS.search(raw) or _ZONE.search(raw) or _PHONE.search(raw):
        return False
    low = raw.lower()
    for s in shelters:  # real names/addresses must come from code, not the model
        for field in ("name", "address"):
            if s.get(field) and s[field].lower() in low:
                return False
    return True


def _fill(text, facts):
    text = text.replace("{{ZONE}}", str(facts.get("zone")))
    for i, s in enumerate((facts.get("shelters") or [])[:3]):
        text = text.replace("{{SHELTER_%d}}" % (i + 1), s.get("name", ""))
    return text


def _with_medical(card, facts, lang):
    """Deterministic medical-needs lines (EEAP, 7 days of medicine, power, special-needs shelter)."""
    if not (facts.get("flags") or {}).get("medical"):
        return card
    m = T[lang]["medical"]
    lines = [m["eeap"], m["meds"], m["power"]]
    sn = facts.get("special_needs_shelters") or []
    if sn and sn[0].get("name"):
        lines.append(m["sn"].format(name=sn[0]["name"]))
    if m["eeap"] not in card["what_to_do_now"]:
        card["what_to_do_now"] = (card["what_to_do_now"].rstrip() + "\n" + "\n".join(lines)).strip()
    return card


def _with_footer(card, lang):
    footer = T[lang]["footer"]
    if footer not in card["what_to_do_now"]:
        card["what_to_do_now"] = (card["what_to_do_now"].rstrip() + "\n" + footer).strip()
    return card


def _fact_sections(facts, lang):
    t = T[_lang(lang)]
    flags = facts.get("flags") or {}
    zone = facts.get("zone")
    lines = []
    shelters = (facts.get("shelters") or [])[:3]
    if shelters:
        lines.append(t["shelters"])
        for s in shelters:
            pet = " (" + t["pet"][s.get("pet_friendly")] + ")" if flags.get("pet") else ""
            lines.append(t["shelter"].format(name=s.get("name", ""), d=s.get("distance_mi", "?"), pet=pet))
    else:
        lines.append(t["noshelter"])
    bring = t["bring"] + ([t["petbring"]] if flags.get("pet") else [])
    now = t["now"] + ("\n" + t["nocar"] if flags.get("no_car") else "")
    return {
        "what_this_means": t["zone"].format(z=zone) if zone else t["nozone"],
        "where_to_go": "\n".join(lines),
        "what_to_bring": "\n".join("- " + b for b in bring),
        "what_to_do_now": now,
    }


def facts_only_card(facts, lang):
    return _with_footer(_with_medical(_fact_sections(facts, lang), facts, _lang(lang)), _lang(lang))


# The model may never imply an evacuation order; only officials give one.
_ORDER = re.compile(r"evacu|evakye|evakiye|evakwe", re.I)


# Small models mangle placeholders (**ZONE**, {SHELTER_1}, [ZONE]); normalise them to {{X}}.
_LOOSE = re.compile(r"[*_\[{(]*\b(ZONE|SHELTER_[1-3])\b[*_\]})]*")
_MD = re.compile(r"\*\*|__")


def _normalise(raw):
    return _MD.sub("", _LOOSE.sub(lambda m: "{{%s}}" % m.group(1), raw))


def build_card(facts, lang, force_offline=False):
    """Return (card_text, backend). Falls back to the facts-only card on any problem."""
    lang = _lang(lang)
    if force_offline:  # offline cards are written by code; local Gemma is kept for Ask
        return facts_only_card(facts, lang), "facts_only"
    try:
        raw, backend = generate(build_prompt(facts, lang), force_offline)
        if backend != "gemini":  # the small local model's card copy is not good enough to ship
            return facts_only_card(facts, lang), "facts_only"
        raw = _normalise(raw)
        sections = _parse(raw)
        if sections is None or not _valid(raw, facts):
            return facts_only_card(facts, lang), "facts_only"
        card = {k: _fill(sections[k], facts) for k in KEYS}
        if any("{{" in v or "SHELTER_" in v for v in card.values()):
            return facts_only_card(facts, lang), "facts_only"
        base = _fact_sections(facts, lang)
        card["where_to_go"], card["what_to_bring"] = base["where_to_go"], base["what_to_bring"]
        for k in ("what_this_means", "what_to_do_now"):
            if _ORDER.search(card[k]):
                card[k] = base[k]
        return _with_footer(_with_medical(card, facts, lang), lang), backend
    except Exception:
        return facts_only_card(facts, lang), "facts_only"
