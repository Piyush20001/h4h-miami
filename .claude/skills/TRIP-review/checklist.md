# Code Review Checklist

This file is the **single source of truth** for code-review criteria. Both human-driven reviews via `.claude/skills/TRIP-review` and Codex-driven reviews via `.claude/skills/codex-code-review` apply the criteria below — referenced, not copied — so the two review surfaces cannot drift.

## Systematic Review Checklist

### 1. Functional Requirements

- [ ] Implementation logic matches requirements correctly
- [ ] Interface/API matches documented specifications
- [ ] Error scenarios handled with proper feedback
- [ ] Edge cases and boundary conditions validated

### 2. Code Quality

- [ ] Proper typing (no unjustified dynamic types)
- [ ] DRY principle - no code duplication
- [ ] KISS principle - not unnecessarily complex
- [ ] Consistent, descriptive naming conventions
- [ ] Complex logic has explanatory comments
- [ ] Files/modules not excessively large
- [ ] Imports/includes organized, unused ones removed

### 3. Architectural Compliance

- [ ] Code follows established patterns from ARCHI.md
- [ ] Proper separation of concerns
- [ ] Appropriate abstractions used
- [ ] Consistent with existing codebase style

- [ ] Card/AI slice boundaries respected; shared `app.py` / `index.html` touched only in own route/section

### 4. StormCard Safety Rules

- [ ] Zone, shelter names, addresses and phone numbers come only from data, filled by code (never model output)
- [ ] Model output is validated; facts-only card shown if validation fails
- [ ] Shelters labeled as candidates with "call 311 to confirm open"; unknown pet eligibility never shown as yes
- [ ] No category-based evacuation claims; card ends with the official-orders line
- [ ] Ask answers only from card + guidance.md, else "I don't know. Call 311."
- [ ] Model output rendered as text, never HTML

### 5. Offline & Gemma 4

- [ ] Works with Wi-Fi off via Ollama (Force offline tested)
- [ ] Gemini API path has a timeout and falls back cleanly
- [ ] Backend badge shows which Gemma 4 path answered
- [ ] No CDN scripts, external fonts or remote assets
- [ ] Strings present in kre / es / en

### 6. Error Handling

- [ ] Errors are properly caught and handled
- [ ] Error messages are clear and actionable
- [ ] Failure modes are graceful
- [ ] Logging is appropriate (not too verbose, not silent)

### 7. Security

- [ ] Input validation implemented
- [ ] No sensitive data exposed
- [ ] Authentication/authorization respected
- [ ] No obvious vulnerabilities

### 8. Performance

- [ ] No obvious performance issues
- [ ] Resource cleanup implemented (no leaks)
- [ ] Appropriate data structures used
- [ ] No unnecessary operations in hot paths

---

## Issue Severity Classification

**Critical (Block Deployment)**:

- Security vulnerabilities
- Data corruption risks
- Breaking API/interface changes
- Authentication bypasses

**Major (Require Immediate Fix)**:

- Incorrect business logic
- Significant performance degradation
- Missing error handling
- Compilation/build errors

**Minor (Should Fix)**:

- Code style inconsistencies
- Missing documentation
- Code duplication
- Missing edge case handling

**Suggestions (Nice to Have)**:

- Performance optimizations
- Readability improvements
- Additional test coverage

---

## Review Completion Criteria (Approval Gate)

Minimum for approval:

- [ ] All functional requirements implemented
- [ ] No critical or major issues remaining
- [ ] `.venv/bin/python -m py_compile *.py` and `.venv/bin/python -c "import app"` succeed
- [ ] Affected tests pass (`.venv/bin/python -m pytest -q` if `tests/` exists) and the TRIP-2 curl checks pass online + `force_offline`
- [ ] New logic has test coverage (or a coverage-debt ledger entry per the hard-to-cover policy)
- [ ] Documentation updated per project standards
