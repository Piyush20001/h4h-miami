# h4h-miami

Our project for [Hack for Humanity: Miami](https://github.com/AI-Collective-Hackathons/hack-for-humanity-miami) — October 10, 2026, The LAB Miami.

**Team plan + architecture:** [docs/1-plans/PLAN.md](docs/1-plans/PLAN.md) · [docs/ARCHI.md](docs/ARCHI.md)

## Submission info

- **Build for Miami track:** _TBD (01 Four Forces, One City · 02 Wild Miami · 03 Brain Gain · 04 Data to Action)_
- **MLH challenges entered:** Best Use of Gemma 4 · Best Open-Source AI Project _(confirm before submitting)_
- **Model used:** **Gemma 4 — `gemma-4-26b-a4b-it`** (Gemma 4 26B A4B IT), accessed through the **Gemini API**. Integration: [`gemma.py`](gemma.py)

## What it does

_TBD_

## Tech stack

- Gemma 4 (`gemma-4-26b-a4b-it`) via the Gemini API, using the `google-genai` Python SDK
- Python 3.10+

## Data sources

- **Storm surge planning zones (A–E):** Miami-Dade County, [StormSurgePlanningZone_Multipart](https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/ArcGIS/rest/services/StormSurgePlanningZone_Multipart/FeatureServer/0) (`ZONEID`). Saved as `data/zones.geojson`.
- **Shelters:** Florida Division of Emergency Management, [Risk Shelter Inventory (General)](https://services.arcgis.com/3wFbqsFPLeKqOlIK/arcgis/rest/services/Risk_Shelter_Inventory_General/FeatureServer/0), filtered to Miami-Dade, as of 2021-08-31 (40 buildings). Saved as `data/shelters.geojson`. Miami-Dade's own evacuation-center layers return no rows outside an activation, so these are **planning candidates only: call 311 to confirm a shelter is open.** Pet eligibility is shown only where the source says "Yes"; blank means unknown.

## Running locally

```bash
git clone https://github.com/Piyush20001/h4h-miami.git && cd h4h-miami
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # paste your key from https://aistudio.google.com/apikey
python gemma.py "your prompt"                 # text
python gemma.py "describe this" photo.jpg     # text + image
flask --app app run --host 0.0.0.0 --port 8000   # StormCard at http://localhost:8000
```

Tests: `python test_geo.py && python test_prompts_card.py`

Set `GEMMA_MODEL=gemma-4-31b-it` in `.env` to switch to the larger Gemma 4 model.

## Team

- [@Piyush20001](https://github.com/Piyush20001)

## License

[MIT](LICENSE)
