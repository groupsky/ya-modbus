---
paths: /**/{AGENTS,CLAUDE}.md, /.github/copilot-instructions.md, /**/docs/agents/*.md, /**/.claude/rules/**/*.md, /**/.cursor/rules/**/*.md
---

# Agent Documentation Maintenance

AGENTS.md files provide instructions to AI coding agents (Claude, Cursor, Copilot, etc.).
AI tooling automatically reads these files and includes them in the agent's context.

## Core Principles

- No common knowledge
- ~50 lines max per file (except AGENTS.md if needed for compliance)
- Reference > copy: point to source files, don't embed
- Progressive disclosure: load only relevant context per task
- Effectiveness > brevity: force agents to read docs before acting
- No inline examples: agents MUST read comprehensive docs and source code

## AGENTS.md Structure

- AGENTS.md = navigation + blocking instructions
- May exceed ~15-20 lines if needed to force compliance
- Include checklist, trigger-based instructions
- Points to docs/agents/\*.md for detailed guidelines
- Use ALL CAPS for imperative keywords (READ, BEFORE, NEVER, ALWAYS, MUST)
- NEVER include code examples or violation demonstrations

## Scope & Inheritance

- AGENTS.md can be placed in any directory
- Applies to all files within that directory (recursively)
- Nested AGENTS.md extends and overrides parent AGENTS.md
- Child docs should NOT repeat parent instructions

## File Naming

- Canonical: AGENTS.md
- Symlinks: CLAUDE.md → AGENTS.md
- Agent docs: .claude/rules/agents → docs/agents (Claude Code)
- Agent docs: .cursor/rules/agents → docs/agents (Cursor IDE)

## Frontmatter

- Use `paths:` to specify where the doc applies

## When to Update

- New patterns/conventions adopted
- Confusion during development
- Non-obvious architectural decisions

## What NOT to Include

- Implementation details (use code comments)
- Temporary workarounds
- Information in standard docs
- Code examples or snippets (point to source files instead)
- Violation demonstrations (agents learn from comprehensive docs)
