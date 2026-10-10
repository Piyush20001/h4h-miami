"""StormCard card eval: same 12 scenarios x {kre, es, en}.

    .venv/bin/python evals/run_evals.py [--lang kre] [--offline] [--model NAME] [--judge]

Online: Gemma via Gemini API (retries on 429/5xx; production would fall back instead), run through prompts_card.build_card.
Offline: Ollama writes the raw text, which is then fed through build_card as if it
were Gemini (production always ships facts_only offline; this shows whether the
local model *would* pass). Results go to evals/results/<timestamp>.json.
"""
import argparse
import collections
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import llm  # noqa: E402  (loads .env)
import prompts_card as pc  # noqa: E402
from app import _facts  # noqa: E402  same facts as POST /api/card

MODEL_KEYS = tuple(getattr(pc, "MODEL_KEYS", ("what_this_means", "what_to_do_now")))  # sections the model's words survive in
PET_OK = {
    "en": r"(take|takes|accept|accepts|allow|allows)\s+pets|pets?\s+(are\s+)?(ok|welcome|allowed)|pet[- ]friendly",
    "es": r"(acepta|aceptan|admite|admiten|permite|permiten)\s+mascotas|mascotas\s+(permitidas|bienvenidas)",
    "kre": r"(?<!pa )aksepte\s+b[eè]t|b[eè]t\s+(yo\s+)?(ka|gen dwa)\s+(vini|antre)",
}


def _redact(s):
    key = os.getenv("GEMINI_API_KEY")
    s = str(s)
    return s.replace(key, "***") if key else s


def _ctx(text, m, pad=40):
    a, b = max(0, m.start() - pad), min(len(text), m.end() + pad)
    return text[a:b].replace("\n", " / ")


def diagnose(raw, facts):
    """Replay build_card's checks on the raw text; name every reason it would fall back."""
    reasons = []
    norm = pc._normalise(raw)
    sections = pc._parse(norm)
    if sections is None:
        heads = [ln.strip() for ln in norm.splitlines() if ln.strip().startswith("#")]
        reasons.append({"validator": "_parse", "why": "missing/empty section", "snippet": " | ".join(heads) or norm[:120]})
    shelters = facts.get("shelters") or []
    allowed = {"SHELTER_%d" % (i + 1) for i in range(min(3, len(shelters)))} | ({"ZONE"} if facts.get("zone") else set())
    for p in pc._PLACEHOLDER.findall(norm):
        if p.strip() not in allowed:
            reasons.append({"validator": "_valid:placeholder", "why": "placeholder not allowed", "snippet": "{{%s}}" % p})
    for name, rx in (("_ADDRESS", pc._ADDRESS), ("_ZONE", pc._ZONE), ("_PHONE", pc._PHONE)):
        for m in rx.finditer(norm):
            reasons.append({"validator": "_valid:" + name, "why": "matched %r" % m.group(0), "snippet": _ctx(norm, m)})
    low = norm.lower()
    for s in shelters:
        for field in ("name", "address"):
            if s.get(field) and s[field].lower() in low:
                reasons.append({"validator": "_valid:shelter_" + field, "why": "real shelter %s in text" % field, "snippet": s[field]})
    if sections is not None and not reasons:
        filled = {k: pc._fill(sections[k], facts) for k in MODEL_KEYS}
        for k, v in filled.items():
            m = re.search(r"\{\{[^}]*\}\}|\S*SHELTER_\S*", v)
            if m:
                reasons.append({"validator": "leftover_placeholder", "why": k, "snippet": _ctx(v, m)})
    return reasons, sections


def order_swaps(sections, facts):
    """_ORDER silently swaps a model section for the template (backend stays gemini)."""
    out = []
    for k in MODEL_KEYS:
        v = pc._fill((sections or {}).get(k, ""), facts)
        m = pc._ORDER.search(v)
        if m:
            out.append({"section": k, "snippet": _ctx(v, m)})
    return out


def truncated(text):
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    if not lines:
        return True
    last = lines[-1]
    return not (last[-1] in ".!?:)" or last.startswith(("-", "*", "•")) or last.startswith("http"))


def check_rules(case, card, sections, facts, lang):
    full = "\n".join(card.values())
    model_text = "\n".join(card.get(k, "") for k in MODEL_KEYS)
    v = []
    for exp in case["must_include_any"]:
        hay = card.get(exp["section"], "") if exp.get("section") else full
        if not any(re.search(r, hay, re.I) for r in exp["any"]):
            v.append({"rule": "missing:" + exp["name"]})
    for bad in case["must_not_include"]:
        for scope, hay in (("final", full), ("raw", "\n".join((sections or {}).values()))):
            m = re.search(bad["re"], hay, re.I | re.M)
            if m:
                v.append({"rule": "forbidden:" + bad["name"], "scope": scope, "snippet": _ctx(hay, m)})
    if facts.get("zone") != case["expect_zone"]:
        v.append({"rule": "zone_mismatch", "snippet": "got %s want %s" % (facts.get("zone"), case["expect_zone"])})
    # model-written lines only (template "No car?" lines excluded)
    tmpl = set(pc._fact_sections(facts, lang).values()) | {pc.T[lang]["footer"]}
    for ln in model_text.splitlines():
        if "?" in ln and ln.strip() not in tmpl and pc.T[lang]["nocar"] not in ln:
            v.append({"rule": "question_to_reader", "snippet": ln.strip()})
    for i, s in enumerate((facts.get("shelters") or [])[:3]):
        if s.get("pet_friendly") is True:
            continue
        for sent in re.split(r"(?<=[.!?])\s+|\n", "\n".join((sections or {}).get(k, "") for k in MODEL_KEYS)):
            if ("SHELTER_%d" % (i + 1) in sent and re.search(PET_OK[lang], sent, re.I)
                    and not re.search(r"311|\b(if|si|no se confirma|pa konfime)\b", sent, re.I)):  # "ask 311 if..." is fine
                v.append({"rule": "pet_claim_unconfirmed", "snippet": sent.strip()})
    for k, text in card.items():
        if truncated(text):
            v.append({"rule": "truncated", "snippet": k + ": " + text.strip()[-60:]})
    return v


def _gemini_with_backoff(prompt, log):
    delay = 5
    for attempt in range(5):
        try:
            return llm._gemini(prompt)
        except BaseException as e:  # noqa: BLE001
            if isinstance(e, KeyboardInterrupt):
                raise
            msg = _redact(e)
            log.append("%s: %s" % (type(e).__name__, msg[:160]))
            if re.search(r"429|RESOURCE_EXHAUSTED|500|503|INTERNAL|UNAVAILABLE", msg) and attempt < 4:
                time.sleep(delay)
                delay *= 2
                continue
            raise llm.LLMError(type(e).__name__) from None


JUDGE = """You are a strict native-speaker editor for {lang_name}. Rate this hurricane card text for
language quality for a 74-year-old reader at a 6th-grade level (1 = wrong language or unusable,
5 = natural, correct, standard spelling). List every mistranslation, French/English word, or
unnatural phrase. Reply ONLY with JSON: {{"score": <1-5>, "mistakes": ["...", ...]}}

TEXT:
{text}"""


def judge(text, lang):
    try:
        out = llm._gemini(JUDGE.format(lang_name=pc.LANG_NAMES[lang], text=text))
        return json.loads(re.search(r"\{.*\}", out, re.S).group(0))
    except Exception as e:  # noqa: BLE001
        return {"error": type(e).__name__}


def run_case(case, offline, use_judge):
    lang = case["lang"]
    facts = _facts({"lat": case["lat"], "lng": case["lng"], "flags": case["flags"], "lang": lang})
    cap = {"raw": None, "src": None, "errors": [], "model_s": None}

    def fake_generate(prompt, force_offline=False):
        t = time.time()
        try:
            if offline:
                cap["raw"], cap["src"] = llm._ollama(prompt), "ollama"
            else:
                cap["raw"], cap["src"] = _gemini_with_backoff(prompt, cap["errors"]), "gemini"
        finally:
            cap["model_s"] = round(time.time() - t, 2)
        return cap["raw"], "gemini"  # offline: pretend Gemini so the post-gate checks run

    orig, pc.generate = pc.generate, fake_generate
    t0 = time.time()
    try:
        card, backend = pc.build_card(facts, lang, False)
    finally:
        pc.generate = orig
    total = round(time.time() - t0, 2)

    if cap["raw"] is None:
        reasons, sections = [{"validator": "model_error", "why": "; ".join(cap["errors"])[:200], "snippet": ""}], None
    else:
        reasons, sections = diagnose(cap["raw"], facts)
    if backend == "facts_only" and not reasons:
        reasons = [{"validator": "exception_in_build_card", "why": "unknown", "snippet": ""}]
    model_words = len(" ".join((sections or {}).get(k, "") for k in MODEL_KEYS).split())
    res = {
        "id": case["id"], "lang": lang, "flags": case["flags"], "zone": facts.get("zone"),
        "model_source": cap["src"], "backend": "ollama" if offline and backend != "facts_only" else backend, "passed_through": backend != "facts_only",
        "rejection_reasons": reasons if backend == "facts_only" else [],
        "order_swaps": order_swaps(sections, facts) if backend != "facts_only" else [],
        "latency_s": total, "model_latency_s": cap["model_s"], "model_errors": cap["errors"],
        "raw_words": len((cap["raw"] or "").split()), "model_section_words": model_words,
        "raw_text": cap["raw"], "card": card,
        "violations": check_rules(case, card, sections, facts, lang),
        "raw_truncated": {k: truncated(v) for k, v in (sections or {}).items()},
    }
    if use_judge and res["passed_through"]:
        res["judge"] = judge("\n".join(card[k] for k in MODEL_KEYS), lang)
    return res


def summarize(results):
    by = collections.defaultdict(list)
    for r in results:
        by[r["lang"]].append(r)
    print("\n%-4s %3s %10s %8s %8s %6s %6s %8s  %s" % ("lang", "n", "passthru", "viol", "swaps", "lat_s", "words", "judge", "top rejection reasons"))
    for lang, rs in by.items():
        passed = [r for r in rs if r["passed_through"]]
        viol = sum(1 for r in passed if any(v.get("scope", "final") == "final" for v in r["violations"]))
        reasons = collections.Counter(x["validator"] for r in rs for x in r["rejection_reasons"][:1])
        scores = [r["judge"]["score"] for r in passed if isinstance(r.get("judge"), dict) and "score" in r["judge"]]
        print("%-4s %3d %4d/%-2d %3.0f%% %8d %8d %6.1f %6.0f %8s  %s" % (
            lang, len(rs), len(passed), len(rs), 100 * len(passed) / len(rs), viol,
            sum(1 for r in passed if r["order_swaps"]), sum(r["latency_s"] for r in rs) / len(rs),
            sum(r["model_section_words"] for r in rs) / len(rs),
            ("%.1f" % (sum(scores) / len(scores))) if scores else "-",
            ", ".join("%s x%d" % kv for kv in reasons.most_common(3)) or "-"))
    rules = collections.Counter((r["lang"], v["rule"] + ("@" + v["scope"] if "scope" in v else ""))
                                for r in results if r["passed_through"] for v in r["violations"])
    if rules:
        print("\nRule violations on passing cards (lang, rule[@scope]): count")
        for (lang, rule), n in sorted(rules.items()):
            print("  %-4s %-40s %d" % (lang, rule, n))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=["kre", "es", "en"])
    ap.add_argument("--offline", action="store_true", help="raw text from local Ollama instead of Gemini")
    ap.add_argument("--model", help="GEMMA_MODEL (online) or OLLAMA_MODEL (offline)")
    ap.add_argument("--judge", action="store_true", help="online Gemma rates language quality of passing cards")
    ap.add_argument("--cases", default=str(Path(__file__).with_name("cases.json")))
    a = ap.parse_args()
    if a.model:
        os.environ["OLLAMA_MODEL" if a.offline else "GEMMA_MODEL"] = a.model
    model = os.getenv("OLLAMA_MODEL", "gemma4:e2b-it-qat") if a.offline else os.getenv("GEMMA_MODEL", "gemma-4-26b-a4b-it")
    cases = [c for c in json.load(open(a.cases, encoding="utf-8")) if not a.lang or c["lang"] == a.lang]
    results = []
    for c in cases:
        r = run_case(c, a.offline, a.judge)
        first = (r["rejection_reasons"] or [{}])[0]
        print("%-32s %-10s %5.1fs %s %s" % (c["id"], r["backend"], r["latency_s"],
              ("[%s] %s" % (first.get("validator"), first.get("snippet", "")[:70])) if first else "",
              "viol=%d" % len(r["violations"])), flush=True)
        results.append(r)
    out = Path(__file__).with_name("results")
    out.mkdir(exist_ok=True)
    path = out / ("%s_%s%s.json" % (time.strftime("%Y%m%d-%H%M%S"), "offline" if a.offline else "online", "_" + a.lang if a.lang else ""))
    path.write_text(json.dumps({"model": model, "offline": a.offline, "results": results}, ensure_ascii=False, indent=1), encoding="utf-8")
    summarize(results)
    print("\nmodel:", model, "| results:", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
