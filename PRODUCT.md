# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS + vanilla JS served by a small Flask app (`app.py`). No framework, no build step, no CDN scripts or web fonts: everything is served from the laptop so it works with the Wi-Fi off. Decided in the team plan (docs/ARCHI.md).

## Users

The primary user is the **resident herself**, using StormCard alone on her phone (iPhone Safari, Add to Home Screen) or on a community-hub laptop. Demo persona: Madame Joseph, a composite: 74, Little Haiti, speaks Haitian Creole and little English, has a small dog, no car. Moment of use: about two days before a hurricane makes landfall, under stress, with networks that may fail.

Secondary (named in the README, not designed for separately): Spanish-speaking families in Hialeah; volunteers at churches and libraries who keep the hub laptop running.

## Product Purpose

Turn a Miami-Dade location into a one-page hurricane action card in her language: her storm surge zone, three nearby shelter candidates that fit her household (pets, medical needs), what to bring, and what to do now. Then answer her follow-up questions, including when the internet is down. Success: she knows where to go, what to bring and whom to call, in her own language, in under a minute.

## Positioning

Cloud apps die with the cell towers. StormCard's answers come from Gemma 4, an open-weight model that also runs locally on a community-center laptop, while every fact (zone, shelter names, addresses) comes from Miami-Dade county data and is inserted by code, never invented by the model.

## Operating Context

- Hack for Humanity: Miami, Oct 10, 2026 (Track 01 Four Forces, One City). 2-minute live demo; judges weight community impact 30%, working build 25%, use of AI and data 20%.
- Demo: the online card on the iPhone; the Wi-Fi-off question on the laptop (a phone in airplane mode cannot reach the laptop's local model).
- Two Gemma 4 paths: Gemini API (`gemma-4-26b-a4b-it`) online, Ollama (`gemma4:e4b`) offline; the UI shows which one answered.

## Capabilities and Constraints

- Languages: Haitian Creole (Kreyòl), Spanish (Español) and English, all fully supported. All three matter equally in Miami; none is an afterthought.
- Location: three preset demo locations (Little Haiti, Hialeah, Brickell); "use my location" only if time allows. No address geocoding.
- Household flags: pet, no car, medical needs, kids.
- Card sections: What this means / Where to go / What to bring / What to do now.
- Ask: answers only from the card and cited county guidance; otherwise "I don't know. Call 311."
- Shelter data: the county's live shelter layers are empty outside an active storm, so a small hand-verified sample dataset is used and labeled "sample data".
- Out of scope: live shelter capacity, accounts, SMS, other counties, text-to-speech, address search.

## Brand Commitments

Name: **StormCard**. No logo, colors or voice decided yet.

## Evidence on Hand

- Pain points with sources: `StormCard Hack for Humanity Miami Plan.md` (outside the repo): Irma surge-zone confusion, shelter snafus, Creole speakers missing warnings, pet owners stranded, no power/signal.
- County data: `data/zones.geojson` (Miami-Dade storm surge planning zones). Shelter list: sample, hand-verified.
- No testimonials, users, partners or endorsements exist; do not fabricate any.

## Product Principles

1. **Facts by code, words by model.** Zone, shelter names, addresses and phone numbers come only from data.
2. **Never overclaim.** Shelters are candidates: "Call 311 to confirm it's open." No category-based evacuation claims. Always defer to Miami-Dade Emergency Management.
3. **One path, no dead ends.** Few choices, every screen has one obvious next step, and failures still show the facts.
4. **Her language first.** Every word on screen exists in Kreyòl, Español and English.
5. **Works when the network doesn't.** Nothing the core flow needs is fetched from the internet.

## Accessibility & Inclusion

- Large type and high contrast, readable by a 74-year-old at arm's length; WCAG AA minimum.
- Low literacy: icons with very short words; short sentences at a 6th-grade level or lower.
- Stress-proof: few choices, big touch targets, no hidden steps or gestures, nothing time-limited.
- Fully usable on a phone held in one hand.
