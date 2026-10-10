---
version: 1
slug: "static-index-html"
primary_target: "static/index.html"
related_targets: []
---

# StormCard app screen (static/index.html)

Mode: Operate. Single-page app; the resident uses it alone on her phone (iPhone Safari, Home Screen), also on the hub laptop. Code-led.

Audience & job: Madame Joseph (composite, 74, Little Haiti, Kreyòl, small dog, no car), stressed, two days before landfall. Job: in under a minute, know her storm surge zone, where to go, what to bring, whom to call; then ask follow-ups, also offline.

User feedback (binding): round 1 favorites were Hurricane Tracking Chart and Evacuation Route Signage, but "colors too much and strong"; earlier UI drafts "looked vibecoded". Wants: best UI, easy to use, calm.

## Direction contract

THESIS: Her card is her own hurricane tracking chart, plotted around her house and labeled like the road signs she already obeys. Refuses the category default (white cards, blue pills, chevron rows) and the loud weather-TV / poster look.

OWN-WORLD: Quiet chart paper (#f4f6f5 ground, #ffffff sheets), navy ink #15293d for all text (never grey below AA), one calm sign blue #2c5c8a for the primary action and the active state, hairline chart grid #cfdae0, muted storm red #a4473c ONLY for warnings and the 311 line, muted green #3d7556 for "pets OK". Zone plate = reversed navy plate with white highway-style lettering. Section header tabs with 1px hairline borders. Two text sizes per screen (20px body, 28px headings) plus the zone display (~88px). System font stack only, heavy weights for sign lettering.

STORY: She picks her language, her place, her household, gets one calm card: zone plate → chart of her house and three shelters → what to bring → what to do now; she can ask a question and sees whether local Gemma or the Gemini API answered. Every fact says where it came from.

FIRST VIEWPORT (card screen, 390 wide): top bar: StormCard mark + language switch + back. Zone plate (navy, white "ZÒN C", one line "not your flood-insurance zone"). Below: the chart panel (≈ 300px tall) with lat/long hairline grid, "LAKAY OU" marker, shelters 1–3 plotted from real coordinates, routes drawn only at 0/45/90°. Below: shelter arrow plates (number, name, miles, pet mark, "call 311 to confirm"). Primary action stays reachable: "Poze yon kesyon" (Ask) sticky at bottom.

FORM: Hurricane Tracking Chart (assigned, #3 of grounded list) fused with Evacuation Route Signage legibility (#1, user favorite), palette muted per user feedback; seed key 8bac0c18.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: the chart draws itself once when the card arrives (grid fades in, home marker drops, routes stroke from home to each shelter in order 1→3, ~900ms total, disabled under prefers-reduced-motion); tapping a shelter plate highlights its route and marker.

Unresolved: final logo mark (Codex image generation or SVG); Kreyòl copy review by a native speaker.
