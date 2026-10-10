import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

import prompts_ask

GUIDE = (Path(__file__).resolve().parent.parent / "data" / "guidance.md").read_text(encoding="utf-8")


def test_idk_exact():
    assert prompts_ask.IDK == {
        "kre": "Mwen pa konnen. Rele 311.",
        "es": "No lo sé. Llame al 311.",
        "en": "I don't know. Call 311.",
    }


@pytest.mark.parametrize("lang", ["kre", "es", "en"])
def test_prompt_contents(lang):
    p = prompts_ask.build_ask_prompt("Can I bring my dog?", "CARD-MARKER Zone C", lang)
    assert "CARD-MARKER Zone C" in p
    assert "Can I bring my dog?" in p
    assert prompts_ask.LANG_NAMES[lang] in p
    assert prompts_ask.IDK[lang] in p
    assert "shelter of last resort" in p  # guidance included
    assert "kre" not in p.replace("Kreyòl", "")


def test_unknown_lang_falls_back_to_english():
    p = prompts_ask.build_ask_prompt("q", "c", "xx")
    assert prompts_ask.IDK["en"] in p


def test_guidance_size_and_sources():
    assert len(GUIDE.split()) < 900
    assert GUIDE.count("Source: http") >= 6
