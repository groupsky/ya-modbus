---
paths: /**/*
---

# Bug Fixing Guidelines

## Root Cause Analysis

- UNDERSTAND the bug completely before touching code
- Read the error message and stack trace carefully
- Reproduce the bug in isolation (test or CLI)
- Document the minimal reproduction case
- Identify root cause, not just the symptom

## Regression Tests

- WRITE test first that fails due to the bug
- Test must pass ONLY after the fix is applied
- Include test in the same commit as the fix
- Test should prevent this exact bug from recurring
- Use test comments to explain the bug scenario

## Commit Discipline

- One commit = fix + test
- Keep fix scope minimal (change only what broke)
- No opportunistic cleanup in bug fix commits
- Use conventional format: `fix(scope): describe the bug and why it occurred`
- In description, briefly explain root cause and test coverage

## Verification

- Run tests locally before committing
- Verify fix on affected code paths
- Check for similar patterns elsewhere in codebase
- Use `git log --grep=bug` to check for related issues

See: `docs/agents/testing.md` for test patterns
See: `docs/agents/git.md` for commit and PR guidelines
