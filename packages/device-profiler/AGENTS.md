# Device Profiler Package

Modbus device register scanner for discovering register maps.

## Required Reading by Task

BEFORE making ANY changes:
→ READ ../../docs/agents/git.md
→ READ ../../docs/agents/code-quality.md
→ READ ../../docs/agents/testing.md

## Purpose

Automated register discovery through systematic scanning with batch optimization.

## Architecture

See: src/index.ts for exported API
See: bin/profile.ts for CLI entry point
See: README.md for usage examples

## Key Components

- error-classifier.ts - Categorizes Modbus errors
- read-tester.ts - FC03/FC04 operations with timing
- register-scanner.ts - Batch reads with fallback
- console-formatter.ts - Progress display

## Testing

Mock Transport interface only, test error handling and batch fallback.
