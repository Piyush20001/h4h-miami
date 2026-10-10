# Architecture Documentation Rules

[ARCHI.md](ARCHI.md) documents the StormCard architecture. After each task (new feature, refactor, bug fix), determine if ARCHI.md needs updating, and flip **[planned]** markers to **[exists]** as features land.

## When to Update

Update after ANY change that alters:

- Project structure (§4) — new or moved files
- Technology stack (§3) — new dependencies or model changes
- Configuration (§7) — env vars, Force offline behavior
- Server API (§9) — `/api/card` or `/api/ask` request/response shape
- Data layer (§10) — sources, field mappings, sample-data fallback
- Gemma 4 integration (§11) — providers, prompts, validation
- Team workflow (§13) — ownership or checkpoints
- Out of scope (§20) — anything moved in or out

## How to Update by Change Type

### Major Feature / Refactor

Review: §3 Technology Stack, §4 Project Structure, §9 Server API, §11 Gemma 4 Integration, §14 Data Flow, §20 Out of Scope

### Minor Feature / Enhancement

Update: the affected section among §8 UI, §9 Server API, §10 Data Layer, §11 Gemma 4 Integration, plus status markers

### Bug Fix

Usually no update needed, unless it reveals or fixes an architectural flaw (e.g. a fact leaking from model output).

### Dependency Changes

Update: §3 Technology Stack, §6 Build System, and `requirements.txt`

## Guidelines

- Be precise and factual — reflect the actual codebase
- Be concise — enough detail to understand, not implementation specifics
- Update the Mermaid diagram (§14) when data flow changes
- Reference actual file paths
