"""StormCard Ask eval: same 8 questions x {kre, es, en} through agent.run.

    .venv/bin/python evals/run_ask_evals.py [--model NAME] [--online] [--lang kre] [--repeats N] [--judge] [--tag NAME]

Default is offline (force_offline=True, local Ollama, OLLAMA_MODEL=--model). --online uses the
normal path (Gemini first). The card is the facts-only /api/card response for Little Haiti with
pet + no_car, built in-process exactly like app.py. --judge asks online Gemma to score language
quality (1-5) and list invented words / wrong claims. Results go to evals/results/ask-<ts>.json.
"""
import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import agent  # noqa: E402
import geo  # noqa: E402
import llm  # noqa: E402  (loads .env)
import prompts_card as pc  # noqa: E402
from app import _facts  # noqa: E402  same facts as POST /api/card
from prompts_ask import IDK  # noqa: E402

CASES = json.loads((Path(__file__).with_name("ask_cases.json")).read_text(encoding="utf-8"))

PET_OK = {
    "en": r"(take|takes|accept|accepts|allow|allows|welcome|welcomes)\s+(your\s+)?(pets?|dogs?|animals?)|pets?\s+(are\s+)?(ok|welcome|allowed)|pet[- ]friendly|(can|may)\s+(bring|take)\s+(your\s+)?(dog|pet)",
    "es": r"(acepta|aceptan|admite|admiten|permite|permiten)\s+(su\s+|sus\s+|tu\s+)?(mascotas?|perros?|animales)|mascotas\s+(son\s+)?(permitidas|bienvenidas)|puede\s+(llevar|traer)\s+(a\s+)?(su|tu)\s+(perro|mascota)",
    "kre": r"(p[eè]m[eè]t|aksepte|asepte|resevwa)\s+(tout\s+)?(b[eè]t|chen)|(b[eè]t|chen)\s+(yo\s+)?(ka|gen dwa)\s+(vini|antre|ale)|ka\s+(mennen|pote)\s+(chen|b[eè]t)",
}
NEG = {"en": r"\b(not|no|don't|doesn't|isn't|unknown|unsure|confirm)\b",
       "es": r"\b(no|desconoc|confirm)",
       "kre": r"\b(pa|konfime|pa konnen)\b"}
GENERIC = {"en": r"\b(all|the|these|those)\s+(\w+\s+)?shelters\b|\bshelters\b",
           "es": r"\b(todos|los|estos)\s+(\w+\s+)?refugios\b|\brefugios\b",
           "kre": r"\babri\s+(sa\s+)?yo\b|\btout\s+abri\b"}
SOME = r"\b(some|algunos|algunas|k[eè]k|certain|ciertos)\b"
YES = {"en": r"^\s*yes\b", "es": r"^\s*s[ií]\b", "kre": r"^\s*wi\b"}
TU = re.compile(r"\b(debes|tienes|puedes|necesitas|vas|tu|tú|tus|te|ti|contigo)\b", re.I)
CHAT = {
    "en": r"here is|here's|i hope|hope this helps|let me know|feel free|happy to help|great question|anything else|any other questions|i can help",
    "es": r"aquí (tiene|está)|espero que|no dude|cualquier otra|otra pregunta|hola\b|con gusto|puedo ayudar",
    "kre": r"men repons|mwen espere|bonjou|l[oò]t kesyon|mwen ka ede",
}
LEAK = r"evacuation_help|find_shelters|packing_list|lookup_guidance|get_zone|tool results?|provided (information|results)|\bcard\b|herramienta"
EN_STOP = {"the", "and", "you", "your", "is", "are", "with", "of", "please", "have", "this", "if"}

JUDGE = """You grade short answers from a hurricane helper for Miami-Dade residents. Language: {lang_name}.
Facts the helper had: shelters near the user are Dr Michael M Krop HS (pets allowed), E. Darwin Fuchs Pavillion (pets allowed), Miami Northwestern HS (pet policy UNKNOWN, nearest, 1.7 mi). No shelter is confirmed open; call 311 to check. Spanish answers must use "usted", never "tú".

For EACH numbered answer, judge ONLY language quality and correctness of claims:
- score: 1-5 (5 = fluent, natural, correct {lang_name} a native speaker would write; 3 = understandable but awkward/some wrong words; 1 = broken or wrong language)
- bad_words: words/phrases that are invented, non-existent, misspelled or wrong-meaning in {lang_name}, or borrowed from English/French/Spanish where a standard {lang_name} word exists (quote them exactly). Be strict, like a native-speaking editor.
- wrong_claims: claims that contradict the facts above (e.g. Miami Northwestern takes pets, a shelter is open)

Reply with ONLY a JSON array, one object per answer in order: [{{"n": 1, "score": 4, "bad_words": [], "wrong_claims": []}}, ...]

{items}"""


def build_card(lang):
    """Mirror POST /api/card with force_offline (facts-only card)."""
    h = CASES["home"]
    facts = _facts({"lat": h["lat"], "lng": h["lng"], "lang": lang, "flags": h["flags"]})
    extra = {k: facts[k] for k in ("special_needs_shelters", "bus_pickups") if k in facts}
    card_text, backend = pc.build_card(facts, lang, True)
    return dict(zone=facts["zone"], shelters=facts["shelters"], card_text=card_text, backend=backend,
                facts=facts, sources={"zones": geo.ZONES_SOURCE, "shelters": geo.SHELTERS_SOURCE},
                sample_data=geo.SAMPLE_DATA, **extra)


def _sentences(text):
    return [s for s in re.split(r"(?<=[.!?])\s+|\n+", text) if s.strip()]


def checks(case, lang, answer, card):
    a = answer.strip()
    low = a.lower()
    res = {}
    if case.get("offtopic"):
        res["idk_ok"] = a == IDK[lang]
        res["false_idk"] = False
    else:
        res["false_idk"] = a == IDK[lang]
    confirmed = [s["name"] for s in card["shelters"] if s.get("pet_friendly") is True]
    unconfirmed = [s["name"] for s in card["shelters"] if s.get("pet_friendly") is not True]
    over = []
    for s in _sentences(a):
        sl = s.lower()
        if not re.search(PET_OK[lang], sl) or re.search(NEG[lang], sl) or re.search(SOME, sl):
            continue
        named_bad = any(n.lower() in sl for n in unconfirmed)
        named_ok = any(n.lower() in sl for n in confirmed)
        if named_bad or (not named_ok and re.search(GENERIC[lang], sl)):
            over.append(s.strip())
    if case["id"] == "dog" and re.search(YES[lang], low) and not any(n.lower() in low for n in confirmed):
        over.append("generic yes: " + a[:60])
    res["pet_overclaim"] = over
    res["tu"] = sorted({m.group(0).lower() for m in TU.finditer(a)}) if lang == "es" else []
    res["chat"] = sorted({m.group(0).lower() for m in re.finditer(CHAT[lang] + "|" + LEAK, low)})
    if lang != "en":
        words = re.findall(r"[a-z']+", low)
        res["lang_mismatch"] = sum(w in EN_STOP for w in words) >= 3
    else:
        res["lang_mismatch"] = False
    res["missing_311"] = bool(case.get("needs_311")) and "311" not in a
    res["words"] = len(a.split())
    res["too_long"] = res["words"] > 70 or len(_sentences(a)) > 5
    return res


def judge(lang, rows):
    names = {"kre": "Haitian Creole (Kreyòl Ayisyen)", "es": "Spanish", "en": "English"}
    items = "\n\n".join(f"{i + 1}. QUESTION: {r['question']}\nANSWER: {r['answer']}" for i, r in enumerate(rows))
    for attempt in range(3):
        try:
            out = llm._gemini_call(JUDGE.format(lang_name=names[lang], items=items), 90)
            arr = json.loads(re.search(r"\[.*\]", out, re.S).group(0))
            return arr
        except Exception as e:  # noqa: BLE001  judge is best-effort
            print(f"  judge {lang} attempt {attempt + 1} failed: {type(e).__name__}", flush=True)
            time.sleep(3)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.getenv("OLLAMA_MODEL", "hf.co/unsloth/gemma-4-E2B-it-GGUF:Q4_K_M"))
    ap.add_argument("--online", action="store_true")
    ap.add_argument("--lang", choices=["kre", "es", "en"])
    ap.add_argument("--repeats", type=int, default=1)
    ap.add_argument("--judge", action="store_true")
    ap.add_argument("--tag", default="")
    args = ap.parse_args()
    os.environ["OLLAMA_MODEL"] = args.model
    langs = [args.lang] if args.lang else ["kre", "es", "en"]

    calls = []  # instrument llm.generate: prompt sizes + backend per call
    real_generate = llm.generate

    def spy(prompt, force_offline=False, deadline=None):
        t0 = time.monotonic()
        text, backend = real_generate(prompt, force_offline, deadline=deadline)
        calls.append({"chars": len(prompt), "backend": backend, "s": round(time.monotonic() - t0, 1)})
        return text, backend
    llm.generate = spy

    if not args.online:
        llm.warm()
    rows = []
    for lang in langs:
        card = build_card(lang)
        for rep in range(args.repeats):
            for case in CASES["cases"]:
                q = case["q"][lang]
                calls.clear()
                t0 = time.monotonic()
                out = agent.run(q, card, lang, force_offline=not args.online)
                dt = round(time.monotonic() - t0, 1)
                path = "fallback" if any(s["tool"] == "fallback" for s in out["trace"]) else (
                    "check-idk" if any(s["tool"] == "check" for s in out["trace"]) else "agent")
                row = {"lang": lang, "id": case["id"], "rep": rep, "question": q, "answer": out["answer"],
                       "backend": out["backend"], "path": path, "trace": [s["tool"] for s in out["trace"]],
                       "trace_full": out["trace"], "calls": list(calls), "latency_s": dt,
                       **checks(case, lang, out["answer"], card)}
                rows.append(row)
                print(f"[{lang} {case['id']:8} {dt:5.1f}s {path:9} {row['backend']}] {out['answer'][:150]!r}", flush=True)

    if args.judge:
        for lang in langs:
            lr = [r for r in rows if r["lang"] == lang]
            arr = judge(lang, lr) or []
            by_n = {j.get("n"): j for j in arr if isinstance(j, dict)}
            for i, r in enumerate(lr):
                if i + 1 in by_n:
                    r["judge"] = by_n[i + 1]

    print(f"\nmodel={'ONLINE' if args.online else args.model} tag={args.tag} repeats={args.repeats}")
    hdr = f"{'lang':4} {'n':>3} {'petOver':>7} {'tu':>3} {'chat':>4} {'idkOK':>5} {'fIDK':>4} {'mis311':>6} {'langX':>5} {'long':>4} {'fallbk':>6} {'judge':>5} {'badW':>4} {'wrongC':>6} {'lat_s':>5} {'chars':>6}"
    print(hdr)
    summary = {}
    for lang in langs:
        lr = [r for r in rows if r["lang"] == lang]
        js = [r["judge"] for r in lr if isinstance(r.get("judge"), dict)]
        off = [r for r in lr if "idk_ok" in r]
        s = {
            "n": len(lr),
            "pet_overclaim": sum(bool(r["pet_overclaim"]) for r in lr),
            "tu": sum(bool(r["tu"]) for r in lr),
            "chat": sum(bool(r["chat"]) for r in lr),
            "idk_ok": f"{sum(r['idk_ok'] for r in off)}/{len(off)}",
            "false_idk": sum(r["false_idk"] for r in lr),
            "missing_311": sum(r["missing_311"] for r in lr),
            "lang_mismatch": sum(r["lang_mismatch"] for r in lr),
            "too_long": sum(r["too_long"] for r in lr),
            "fallback": sum(r["path"] == "fallback" for r in lr),
            "judge": round(sum(j.get("score", 0) for j in js) / len(js), 2) if js else None,
            "bad_words": sum(len(j.get("bad_words") or []) for j in js),
            "wrong_claims": sum(len(j.get("wrong_claims") or []) for j in js),
            "latency_s": round(sum(r["latency_s"] for r in lr) / len(lr), 1),
            "avg_prompt_chars": round(sum(c["chars"] for r in lr for c in r["calls"]) / max(1, sum(len(r["calls"]) for r in lr))),
        }
        summary[lang] = s
        print(f"{lang:4} {s['n']:>3} {s['pet_overclaim']:>7} {s['tu']:>3} {s['chat']:>4} {s['idk_ok']:>5} {s['false_idk']:>4} {s['missing_311']:>6} "
              f"{s['lang_mismatch']:>5} {s['too_long']:>4} {s['fallback']:>6} {str(s['judge']):>5} {s['bad_words']:>4} "
              f"{s['wrong_claims']:>6} {s['latency_s']:>5} {s['avg_prompt_chars']:>6}")

    out_dir = Path(__file__).with_name("results")
    out_dir.mkdir(exist_ok=True)
    name = f"ask-{time.strftime('%Y%m%d-%H%M%S')}{'-' + args.tag if args.tag else ''}.json"
    (out_dir / name).write_text(json.dumps({"model": "ONLINE" if args.online else args.model, "tag": args.tag,
                                            "temperature": os.getenv("OLLAMA_TEMPERATURE"),
                                            "summary": summary, "rows": rows}, ensure_ascii=False, indent=1),
                                encoding="utf-8")
    print(f"saved evals/results/{name}")


if __name__ == "__main__":
    main()
