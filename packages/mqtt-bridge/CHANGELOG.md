# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.1.0 (2026-01-04)

### Bug Fixes

- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([d3e027b](https://github.com/groupsky/ya-modbus/commit/d3e027bc75822d970f63733c4d069508a020122a)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **mqtt-bridge:** resolve race conditions in device operations ([#116](https://github.com/groupsky/ya-modbus/issues/116)) ([d18aa74](https://github.com/groupsky/ya-modbus/commit/d18aa7443bd4634ef5027a025679f17dd850825a)), closes [#96](https://github.com/groupsky/ya-modbus/issues/96)
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([ba85dd9](https://github.com/groupsky/ya-modbus/commit/ba85dd9518f85705bc3f87349b097f004a0e90a1)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)

### Code Refactoring

- **mqtt-bridge:** remove duplicate consecutiveFailures tracking ([#127](https://github.com/groupsky/ya-modbus/issues/127)) ([394326b](https://github.com/groupsky/ya-modbus/commit/394326bf81db83327813f4fb2d026839092b9d79)), closes [#93](https://github.com/groupsky/ya-modbus/issues/93)

### Features

- **mqtt-bridge:** add MQTT bridge package with CLI ([#86](https://github.com/groupsky/ya-modbus/issues/86)) ([56908e7](https://github.com/groupsky/ya-modbus/commit/56908e70465e15a97e5c9a721331ffa1b1de86da))
- **mqtt-bridge:** Phase 2 - Driver Integration ([#90](https://github.com/groupsky/ya-modbus/issues/90)) ([17f8210](https://github.com/groupsky/ya-modbus/commit/17f82103255295a24b71027b286c42912bee5b85)), closes [#87](https://github.com/groupsky/ya-modbus/issues/87)
- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([fcaf40a](https://github.com/groupsky/ya-modbus/commit/fcaf40a63452ecce09e82b397d448652354ecd16))
- **transport:** extract transport package for code reusability ([#102](https://github.com/groupsky/ya-modbus/issues/102)) ([b3153bf](https://github.com/groupsky/ya-modbus/commit/b3153bf7a05fdfcab41d896cfdac64fd2defe107)), closes [#107](https://github.com/groupsky/ya-modbus/issues/107) [#108](https://github.com/groupsky/ya-modbus/issues/108) [#109](https://github.com/groupsky/ya-modbus/issues/109) [#91](https://github.com/groupsky/ya-modbus/issues/91)
- **transport:** implement TransportManager with mutex serialization ([#125](https://github.com/groupsky/ya-modbus/issues/125)) ([2a243ac](https://github.com/groupsky/ya-modbus/commit/2a243ac5e0f7c4ea4942f0bdaba7d7a7d78bdd4f)), closes [#126](https://github.com/groupsky/ya-modbus/issues/126)

### BREAKING CHANGES

- **mqtt-bridge:** - ErrorCallback signature changed from (deviceId, error) => number to
  (deviceId, error, failureCount) => void

Testing:

- Added TDD regression tests for both bugs
- All 272 tests passing with 97.77% coverage
- Defensive error handling for callback exceptions
