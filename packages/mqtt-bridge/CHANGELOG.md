# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.6.0 (2026-01-04)

### Bug Fixes

- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([e4ba4fd](https://github.com/groupsky/ya-modbus/commit/e4ba4fdc61c8695c3ab0b9504ef340d19861c599)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **mqtt-bridge:** resolve race conditions in device operations ([#116](https://github.com/groupsky/ya-modbus/issues/116)) ([cafbde4](https://github.com/groupsky/ya-modbus/commit/cafbde4d8412714c80db4e27b33f8e208ed2888c)), closes [#96](https://github.com/groupsky/ya-modbus/issues/96)
- **release:** bump versions to 0.2.0 to bypass npm 24h block ([#148](https://github.com/groupsky/ya-modbus/issues/148)) ([aa2be6a](https://github.com/groupsky/ya-modbus/commit/aa2be6ae998f4443774b43507e7991601ec3068a))
- **release:** revert failed release and add missing publishConfig ([#147](https://github.com/groupsky/ya-modbus/issues/147)) ([60ea209](https://github.com/groupsky/ya-modbus/commit/60ea2091cbb350b0f474dc45d3ab33177b050764))
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([228ae2b](https://github.com/groupsky/ya-modbus/commit/228ae2b4da0c433e475825d068202efd3f0d3a5a)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)

### Code Refactoring

- **mqtt-bridge:** remove duplicate consecutiveFailures tracking ([#127](https://github.com/groupsky/ya-modbus/issues/127)) ([c6288eb](https://github.com/groupsky/ya-modbus/commit/c6288eb1016aaa8d3cb9f0e4e19585167fbdbde4)), closes [#93](https://github.com/groupsky/ya-modbus/issues/93)

### Features

- **mqtt-bridge:** add MQTT bridge package with CLI ([#86](https://github.com/groupsky/ya-modbus/issues/86)) ([acc03a0](https://github.com/groupsky/ya-modbus/commit/acc03a09277b4a16c799234b6319a13d1db18d8e))
- **mqtt-bridge:** Phase 2 - Driver Integration ([#90](https://github.com/groupsky/ya-modbus/issues/90)) ([ae647b2](https://github.com/groupsky/ya-modbus/commit/ae647b2c3a3eb6f8278bbb2731465f9cece64d82)), closes [#87](https://github.com/groupsky/ya-modbus/issues/87)
- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([3db7542](https://github.com/groupsky/ya-modbus/commit/3db7542ddbb7bb150b4deab50d5c96e5d668c852))
- **transport:** extract transport package for code reusability ([#102](https://github.com/groupsky/ya-modbus/issues/102)) ([aea6946](https://github.com/groupsky/ya-modbus/commit/aea6946b40f502ff630c7a0ec599088899c30a90)), closes [#107](https://github.com/groupsky/ya-modbus/issues/107) [#108](https://github.com/groupsky/ya-modbus/issues/108) [#109](https://github.com/groupsky/ya-modbus/issues/109) [#91](https://github.com/groupsky/ya-modbus/issues/91)
- **transport:** implement TransportManager with mutex serialization ([#125](https://github.com/groupsky/ya-modbus/issues/125)) ([012a9e0](https://github.com/groupsky/ya-modbus/commit/012a9e06ad37f7dc07ff2903948ec1454fe3392e)), closes [#126](https://github.com/groupsky/ya-modbus/issues/126)

### Reverts

- Revert "chore(release): publish packages" ([a6d080d](https://github.com/groupsky/ya-modbus/commit/a6d080deeacf306f4911b6d78eab05dac8bfa7a7))

### BREAKING CHANGES

- **mqtt-bridge:** - ErrorCallback signature changed from (deviceId, error) => number to
  (deviceId, error, failureCount) => void

Testing:

- Added TDD regression tests for both bugs
- All 272 tests passing with 97.77% coverage
- Defensive error handling for callback exceptions

## [0.5.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/mqtt-bridge@0.5.0...@ya-modbus/mqtt-bridge@0.5.1) (2026-01-04)

**Note:** Version bump only for package @ya-modbus/mqtt-bridge

# 0.5.0 (2026-01-04)

### Bug Fixes

- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([d3e027b](https://github.com/groupsky/ya-modbus/commit/d3e027bc75822d970f63733c4d069508a020122a)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **mqtt-bridge:** resolve race conditions in device operations ([#116](https://github.com/groupsky/ya-modbus/issues/116)) ([d18aa74](https://github.com/groupsky/ya-modbus/commit/d18aa7443bd4634ef5027a025679f17dd850825a)), closes [#96](https://github.com/groupsky/ya-modbus/issues/96)
- **release:** bump versions to 0.2.0 to bypass npm 24h block ([#148](https://github.com/groupsky/ya-modbus/issues/148)) ([98d6fd6](https://github.com/groupsky/ya-modbus/commit/98d6fd666322fb647390d851c43ba0cd8a02486d))
- **release:** revert failed release and add missing publishConfig ([#147](https://github.com/groupsky/ya-modbus/issues/147)) ([8cbd4ba](https://github.com/groupsky/ya-modbus/commit/8cbd4baf9c140c8ef10080947ddd566014f32c77))
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([ba85dd9](https://github.com/groupsky/ya-modbus/commit/ba85dd9518f85705bc3f87349b097f004a0e90a1)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)

### Code Refactoring

- **mqtt-bridge:** remove duplicate consecutiveFailures tracking ([#127](https://github.com/groupsky/ya-modbus/issues/127)) ([394326b](https://github.com/groupsky/ya-modbus/commit/394326bf81db83327813f4fb2d026839092b9d79)), closes [#93](https://github.com/groupsky/ya-modbus/issues/93)

### Features

- **mqtt-bridge:** add MQTT bridge package with CLI ([#86](https://github.com/groupsky/ya-modbus/issues/86)) ([56908e7](https://github.com/groupsky/ya-modbus/commit/56908e70465e15a97e5c9a721331ffa1b1de86da))
- **mqtt-bridge:** Phase 2 - Driver Integration ([#90](https://github.com/groupsky/ya-modbus/issues/90)) ([17f8210](https://github.com/groupsky/ya-modbus/commit/17f82103255295a24b71027b286c42912bee5b85)), closes [#87](https://github.com/groupsky/ya-modbus/issues/87)
- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([fcaf40a](https://github.com/groupsky/ya-modbus/commit/fcaf40a63452ecce09e82b397d448652354ecd16))
- **transport:** extract transport package for code reusability ([#102](https://github.com/groupsky/ya-modbus/issues/102)) ([b3153bf](https://github.com/groupsky/ya-modbus/commit/b3153bf7a05fdfcab41d896cfdac64fd2defe107)), closes [#107](https://github.com/groupsky/ya-modbus/issues/107) [#108](https://github.com/groupsky/ya-modbus/issues/108) [#109](https://github.com/groupsky/ya-modbus/issues/109) [#91](https://github.com/groupsky/ya-modbus/issues/91)
- **transport:** implement TransportManager with mutex serialization ([#125](https://github.com/groupsky/ya-modbus/issues/125)) ([2a243ac](https://github.com/groupsky/ya-modbus/commit/2a243ac5e0f7c4ea4942f0bdaba7d7a7d78bdd4f)), closes [#126](https://github.com/groupsky/ya-modbus/issues/126)

### Reverts

- Revert "chore(release): publish packages" ([b613837](https://github.com/groupsky/ya-modbus/commit/b6138375978fdebfd57e645367f3fc8011f0452f))

### BREAKING CHANGES

- **mqtt-bridge:** - ErrorCallback signature changed from (deviceId, error) => number to
  (deviceId, error, failureCount) => void

Testing:

- Added TDD regression tests for both bugs
- All 272 tests passing with 97.77% coverage
- Defensive error handling for callback exceptions
