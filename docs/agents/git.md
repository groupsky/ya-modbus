# Git Guidelines

## Branching

- Always use feature branches
- Branch from main, never from other feature branches
- Feature branches are always squashed when merged

## Commits

- One commit = one logical change
- Commit each completed task immediately
- `git diff --cached` before committing to verify scope
- Stage only files relevant to the task
- NEVER stage all untracked files

## Push Policy

- NEVER push without explicit user request
- Wait for user approval before pushing

## Pull Requests

- PRs are always squash-merged
- Squash commit message must reference the PR number
- Squash commit description must reference closed issues
- Example: `feat(cli): add discover command (#123)\n\nCloses #100, #101`

## Commit Messages

- Use conventional commits format
- Focus on "why" not "what"
- Reference issues being closed in description

## Stateless Documentation

- Docs/comments describe current state only
- No "will be implemented" or "was removed" references
- Breaking changes, new features, bugs → commit messages only
