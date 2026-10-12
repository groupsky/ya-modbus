# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.10.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/transport@0.9.1...@ya-modbus/transport@0.10.0) (2026-10-12)

### Features

- **transport:** survive a lost serial port and reopen it after a backoff ([#549](https://github.com/groupsky/ya-modbus/issues/549)) ([b5b3e34](https://github.com/groupsky/ya-modbus/commit/b5b3e34e3f219b6600cd975f98680adebafe3093)), closes [#517](https://github.com/groupsky/ya-modbus/issues/517)

## [0.9.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/transport@0.9.0...@ya-modbus/transport@0.9.1) (2026-10-12)

### Bug Fixes

- **transport:** make Modbus TCP work from the CLI and profiler ([#542](https://github.com/groupsky/ya-modbus/issues/542)) ([2aa24ac](https://github.com/groupsky/ya-modbus/commit/2aa24ac1753416c261d05bb8b8b12fccbc10e3e4))

# [0.9.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/transport@0.8.1...@ya-modbus/transport@0.9.0) (2026-10-12)

- feat!: drop Node.js 20 support (#516) ([70002ab](https://github.com/groupsky/ya-modbus/commit/70002ab28155432e0984c67a70d1469fc5be7cb3)), closes [#516](https://github.com/groupsky/ya-modbus/issues/516)

### BREAKING CHANGES

- Node.js 20 is no longer supported. Use Node.js 22 or 24.

## [0.8.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/transport@0.8.0...@ya-modbus/transport@0.8.1) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/transport

# [0.8.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/transport@0.7.3...@ya-modbus/transport@0.8.0) (2026-10-12)

### Features

- **transport:** keep details of modbus-serial errors instead of "[object Object]" ([#512](https://github.com/groupsky/ya-modbus/issues/512)) ([343dd50](https://github.com/groupsky/ya-modbus/commit/343dd50d011c7e06e86e31701e25a8d5b9e861dc)), closes [#177](https://github.com/groupsky/ya-modbus/issues/177)

## [0.7.3](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/transport@0.7.2...@ya-modbus/transport@0.7.3) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/transport

## [0.7.2](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/transport@0.7.1...@ya-modbus/transport@0.7.2) (2026-02-11)

### Bug Fixes

- **transport:** multiple devices on same bus use correct slave ID ([#235](https://github.com/groupsky/ya-modbus/issues/235)) ([7259914](https://github.com/groupsky/ya-modbus/commit/7259914ca2583c5222c99f3306de87961975d2c4)), closes [#171](https://github.com/groupsky/ya-modbus/issues/171)

## [0.7.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/transport@0.7.0...@ya-modbus/transport@0.7.1) (2026-02-06)

**Note:** Version bump only for package @ya-modbus/transport

# [0.7.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/transport@0.6.0...@ya-modbus/transport@0.7.0) (2026-01-11)

### Features

- **build:** add dual CommonJS/ESM package support ([#187](https://github.com/groupsky/ya-modbus/issues/187)) ([3d78130](https://github.com/groupsky/ya-modbus/commit/3d781304d42edba335cdc320ba25275f3b4ea6c9))

# 0.6.0 (2026-01-04)

### Bug Fixes

- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([e4ba4fd](https://github.com/groupsky/ya-modbus/commit/e4ba4fdc61c8695c3ab0b9504ef340d19861c599)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **release:** bump versions to 0.2.0 to bypass npm 24h block ([#148](https://github.com/groupsky/ya-modbus/issues/148)) ([aa2be6a](https://github.com/groupsky/ya-modbus/commit/aa2be6ae998f4443774b43507e7991601ec3068a))
- **release:** revert failed release and add missing publishConfig ([#147](https://github.com/groupsky/ya-modbus/issues/147)) ([60ea209](https://github.com/groupsky/ya-modbus/commit/60ea2091cbb350b0f474dc45d3ab33177b050764))
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([228ae2b](https://github.com/groupsky/ya-modbus/commit/228ae2b4da0c433e475825d068202efd3f0d3a5a)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)

### Features

- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([3db7542](https://github.com/groupsky/ya-modbus/commit/3db7542ddbb7bb150b4deab50d5c96e5d668c852))
- **transport:** add debug logging for retry attempts ([#115](https://github.com/groupsky/ya-modbus/issues/115)) ([e63de85](https://github.com/groupsky/ya-modbus/commit/e63de85bcca5caea05008065b38ae517009a583d)), closes [#109](https://github.com/groupsky/ya-modbus/issues/109)
- **transport:** extract transport package for code reusability ([#102](https://github.com/groupsky/ya-modbus/issues/102)) ([aea6946](https://github.com/groupsky/ya-modbus/commit/aea6946b40f502ff630c7a0ec599088899c30a90)), closes [#107](https://github.com/groupsky/ya-modbus/issues/107) [#108](https://github.com/groupsky/ya-modbus/issues/108) [#109](https://github.com/groupsky/ya-modbus/issues/109) [#91](https://github.com/groupsky/ya-modbus/issues/91)
- **transport:** implement TransportManager with mutex serialization ([#125](https://github.com/groupsky/ya-modbus/issues/125)) ([012a9e0](https://github.com/groupsky/ya-modbus/commit/012a9e06ad37f7dc07ff2903948ec1454fe3392e)), closes [#126](https://github.com/groupsky/ya-modbus/issues/126)

### Reverts

- Revert "chore(release): publish packages" ([a6d080d](https://github.com/groupsky/ya-modbus/commit/a6d080deeacf306f4911b6d78eab05dac8bfa7a7))

## [0.5.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/transport@0.5.0...@ya-modbus/transport@0.5.1) (2026-01-04)

**Note:** Version bump only for package @ya-modbus/transport

# 0.5.0 (2026-01-04)

### Bug Fixes

- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([d3e027b](https://github.com/groupsky/ya-modbus/commit/d3e027bc75822d970f63733c4d069508a020122a)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **release:** bump versions to 0.2.0 to bypass npm 24h block ([#148](https://github.com/groupsky/ya-modbus/issues/148)) ([98d6fd6](https://github.com/groupsky/ya-modbus/commit/98d6fd666322fb647390d851c43ba0cd8a02486d))
- **release:** revert failed release and add missing publishConfig ([#147](https://github.com/groupsky/ya-modbus/issues/147)) ([8cbd4ba](https://github.com/groupsky/ya-modbus/commit/8cbd4baf9c140c8ef10080947ddd566014f32c77))
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([ba85dd9](https://github.com/groupsky/ya-modbus/commit/ba85dd9518f85705bc3f87349b097f004a0e90a1)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)

### Features

- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([fcaf40a](https://github.com/groupsky/ya-modbus/commit/fcaf40a63452ecce09e82b397d448652354ecd16))
- **transport:** add debug logging for retry attempts ([#115](https://github.com/groupsky/ya-modbus/issues/115)) ([49584c3](https://github.com/groupsky/ya-modbus/commit/49584c30f43d8a1f8870aa965ef76eba3976a3b3)), closes [#109](https://github.com/groupsky/ya-modbus/issues/109)
- **transport:** extract transport package for code reusability ([#102](https://github.com/groupsky/ya-modbus/issues/102)) ([b3153bf](https://github.com/groupsky/ya-modbus/commit/b3153bf7a05fdfcab41d896cfdac64fd2defe107)), closes [#107](https://github.com/groupsky/ya-modbus/issues/107) [#108](https://github.com/groupsky/ya-modbus/issues/108) [#109](https://github.com/groupsky/ya-modbus/issues/109) [#91](https://github.com/groupsky/ya-modbus/issues/91)
- **transport:** implement TransportManager with mutex serialization ([#125](https://github.com/groupsky/ya-modbus/issues/125)) ([2a243ac](https://github.com/groupsky/ya-modbus/commit/2a243ac5e0f7c4ea4942f0bdaba7d7a7d78bdd4f)), closes [#126](https://github.com/groupsky/ya-modbus/issues/126)

### Reverts

- Revert "chore(release): publish packages" ([b613837](https://github.com/groupsky/ya-modbus/commit/b6138375978fdebfd57e645367f3fc8011f0452f))
