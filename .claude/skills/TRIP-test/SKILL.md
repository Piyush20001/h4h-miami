---
name: TRIP-test
description: Write/run tests following project standards (deep test authoring)
disable-model-invocation: true
argument-hint: "component or feature to test"
metadata:
  trip-version: "2.8.4"
---

# Testing Mode

You are now in **testing mode** for **StormCard (h4h-miami)**.

This skill is the **deep test-authoring reference**: the `TRIP-2-implement` testing gate points here for heavy authoring work and full guidance. Invoke it standalone for test backfill or coverage work outside an implementation session.

## Prerequisites - Read First

Before testing, you MUST read:

1. @docs/ARCHI.md - Understand system architecture
2. @docs/4-unit-tests/TESTING.md - Testing guidelines

## Your Task

Test: $ARGUMENTS

---

## Testing Guidelines

### Scope

- Only run tests for relevant files that changed (not the whole project)
- Focus on the new feature/fix/refactor

### Commands

```bash
# Run all tests
.venv/bin/python -m pytest -q

# Run specific test
.venv/bin/python -m pytest -q tests/test_geo.py -k <name>

# With coverage (only if pytest-cov is installed)
.venv/bin/python -m pytest -q --cov=. --cov-report=term-missing
```

### Test Structure

Tests live in `tests/`, named `test_<module>.py` (e.g. `tests/test_geo.py`). pytest is optional today; add it to `requirements.txt` when the first test lands.

### Testing Priorities

**Unit Tests** (pure functions first):

- `geo.py`: point-in-polygon for the Little Haiti / Hialeah / Brickell presets, haversine distance, pet filter, fewer-than-3 results
- `prompts_card.py`: fact-slot filling and validation rejecting stray addresses/zone letters

**Manual / Integration checks** (the real gate today):

- `curl` `/api/card` and `/api/ask` online and with `force_offline: true`
- Full flow in the browser at phone width, all three languages
- Wi-Fi off: fresh Ask question answered by local Gemma
- Unsupported question returns "I don't know. Call 311." 

**What to Test**:

- Happy path scenarios
- Error states and error handling
- Edge cases (null, empty, boundary values)
- Invalid inputs

---

## Hard-to-Test Code

Seam ladder, cheapest first: **exported pure helper → injectable client/adapter → module mock → integration/emulator test**. Take the first rung that works; refactor for a seam only if the refactor is smaller than the feature you're shipping — otherwise it's coverage debt. Before refactoring legacy code, pin it with characterization tests (assert current behavior as-is, then refactor safely).

Uncovered risky paths: one line each in `docs/4-unit-tests/COVERAGE-DEBT.md` (`path | why hard | escape plan`). Delete a ledger line in the same change that gives its path meaningful coverage.

---

## Post-Testing Summary

After completing tests, create a summary file:

**File**: `docs/4-unit-tests/wa_vx.y.z_test.md`
(a = project week, x.y.z = version)

**Content**:

```markdown
# Test Summary - Week a, V. x.y.z

## What Was Tested

[List of tested components/functions]

## Test Results

- Total tests: X
- Passed: X
- Failed: X
- Coverage: X%

## Key Findings

[Any issues discovered, edge cases found, etc.]

## Notes

[Additional context or recommendations]
```
