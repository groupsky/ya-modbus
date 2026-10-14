# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.7.2](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.7.1...@ya-modbus/driver-xymd1@0.7.2) (2026-10-14)

### Bug Fixes

- exclude Node.js 26.4+ in engines and warn about it for serial devices ([#636](https://github.com/groupsky/ya-modbus/issues/636)) ([8c46664](https://github.com/groupsky/ya-modbus/commit/8c46664bdffd90181e6dad4fb6a7fc31ef9fdcc0)), closes [#622](https://github.com/groupsky/ya-modbus/issues/622)

## [0.7.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.7.0...@ya-modbus/driver-xymd1@0.7.1) (2026-10-14)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

# [0.7.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.15...@ya-modbus/driver-xymd1@0.7.0) (2026-10-14)

### Bug Fixes

- **driver-xymd1:** read temperature as signed and default to 8N1 ([#635](https://github.com/groupsky/ya-modbus/issues/635)) ([](https://github.com/groupsky/ya-modbus/commit/)), closes [#609](https://github.com/groupsky/ya-modbus/issues/609) [#628](https://github.com/groupsky/ya-modbus/issues/628)

### BREAKING CHANGES

- **driver-xymd1:** DEFAULT_CONFIG.parity of @ya-modbus/driver-xymd1 is now 'none' (9600 8N1) instead of 'even'. If you relied on the old even default, set parity even yourself.

## [0.6.15](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.14...@ya-modbus/driver-xymd1@0.6.15) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.14](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.13...@ya-modbus/driver-xymd1@0.6.14) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.13](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.12...@ya-modbus/driver-xymd1@0.6.13) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.12](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.11...@ya-modbus/driver-xymd1@0.6.12) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.11](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.10...@ya-modbus/driver-xymd1@0.6.11) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.10](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.9...@ya-modbus/driver-xymd1@0.6.10) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.9](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.8...@ya-modbus/driver-xymd1@0.6.9) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.8](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.7...@ya-modbus/driver-xymd1@0.6.8) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.7](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.6...@ya-modbus/driver-xymd1@0.6.7) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.6](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.5...@ya-modbus/driver-xymd1@0.6.6) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.5](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.4...@ya-modbus/driver-xymd1@0.6.5) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.4](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.3...@ya-modbus/driver-xymd1@0.6.4) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.3](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.2...@ya-modbus/driver-xymd1@0.6.3) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.2](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.1...@ya-modbus/driver-xymd1@0.6.2) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.6.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.6.0...@ya-modbus/driver-xymd1@0.6.1) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

# [0.6.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.5.9...@ya-modbus/driver-xymd1@0.6.0) (2026-10-12)

- feat!: drop Node.js 20 support (#516) ([70002ab](https://github.com/groupsky/ya-modbus/commit/70002ab28155432e0984c67a70d1469fc5be7cb3)), closes [#516](https://github.com/groupsky/ya-modbus/issues/516)

### BREAKING CHANGES

- Node.js 20 is no longer supported. Use Node.js 22 or 24.

## [0.5.9](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.5.8...@ya-modbus/driver-xymd1@0.5.9) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.5.8](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.5.7...@ya-modbus/driver-xymd1@0.5.8) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.5.7](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.5.6...@ya-modbus/driver-xymd1@0.5.7) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.5.6](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.5.5...@ya-modbus/driver-xymd1@0.5.6) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.5.5](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.5.4...@ya-modbus/driver-xymd1@0.5.5) (2026-02-11)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.5.4](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.5.3...@ya-modbus/driver-xymd1@0.5.4) (2026-02-11)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.5.3](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.5.2...@ya-modbus/driver-xymd1@0.5.3) (2026-02-08)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.5.2](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.5.1...@ya-modbus/driver-xymd1@0.5.2) (2026-02-08)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.5.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.5.0...@ya-modbus/driver-xymd1@0.5.1) (2026-02-06)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

# [0.5.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.4.3...@ya-modbus/driver-xymd1@0.5.0) (2026-01-11)

### Features

- **build:** add dual CommonJS/ESM package support ([#187](https://github.com/groupsky/ya-modbus/issues/187)) ([3d78130](https://github.com/groupsky/ya-modbus/commit/3d781304d42edba335cdc320ba25275f3b4ea6c9))

## 0.4.3 (2026-01-04)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## [0.4.2](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-xymd1@0.4.1...@ya-modbus/driver-xymd1@0.4.2) (2026-01-04)

**Note:** Version bump only for package @ya-modbus/driver-xymd1

## 0.4.1 (2026-01-04)

**Note:** Version bump only for package @ya-modbus/driver-xymd1
