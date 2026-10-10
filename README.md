# h4h-miami

Our project for [Hack for Humanity: Miami](https://github.com/AI-Collective-Hackathons/hack-for-humanity-miami) — October 10, 2026, The LAB Miami.

## Submission info

- **Build for Miami track:** _TBD (01 Four Forces, One City · 02 Wild Miami · 03 Brain Gain · 04 Data to Action)_
- **MLH challenges entered:** Best Use of Gemma 4 · Best Open-Source AI Project _(confirm before submitting)_
- **Model used:** **Gemma 4 — `gemma-4-31b-it`** (Gemma 4 31B IT, falls back to `gemma-4-26b-a4b-it` on server errors), accessed through the **Gemini API**. Integration: [`gemma.py`](gemma.py)

## What it does

_TBD_

## Tech stack

- Gemma 4 (`gemma-4-31b-it`, fallback `gemma-4-26b-a4b-it`) via the Gemini API, using the `google-genai` Python SDK
- Python 3.10+

## Data sources

_Cite every dataset used._

## Running locally

```bash
git clone https://github.com/Piyush20001/h4h-miami.git && cd h4h-miami
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # paste your key from https://aistudio.google.com/apikey
python gemma.py "your prompt"                 # text
python gemma.py "describe this" photo.jpg     # text + image
```

Set `GEMMA_MODEL=gemma-4-26b-a4b-it` in `.env` to use the faster, smaller Gemma 4 model.

## Team

- [@Piyush20001](https://github.com/Piyush20001)

## License

[MIT](LICENSE)
