# Agent Documentation Maintenance

## Core Principles

- No common knowledge (TypeScript, npm, Git basics assumed)
- ~50 lines max per file
- Reference > copy: point to source files, don't embed
- Progressive disclosure: load only relevant context per task

## AGENTS.md Structure

- AGENTS.md = navigation ONLY (~15-20 lines)
- Points to docs/agents/\*.md for actual guidelines
- Never embed guidelines directly in AGENTS.md

## File Naming

- Canonical: AGENTS.md
- Symlinks: CLAUDE.md, .aider.md, .cursorrules → AGENTS.md

## When to Update

- New patterns/conventions adopted
- Confusion during development
- Non-obvious architectural decisions

## When NOT to Update

- Implementation details (use code comments)
- Temporary workarounds
- Information in standard docs

See: Code examples in actual source files, not in docs
