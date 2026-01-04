# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.1.0 (2026-01-04)

### Bug Fixes

- **cli:** address review feedback for implicit driver detection ([d8eb571](https://github.com/groupsky/ya-modbus/commit/d8eb5716972ef3fea3fda1c92d37d69c6b0c263a))
- **driver-xymd1:** update valid baud rates to 9600, 14400, and 19200 ([#47](https://github.com/groupsky/ya-modbus/issues/47)) ([d4460ed](https://github.com/groupsky/ya-modbus/commit/d4460ed8dfbf8312cc87fee994a94e7b5a94bdbb))
- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([d3e027b](https://github.com/groupsky/ya-modbus/commit/d3e027bc75822d970f63733c4d069508a020122a)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([ba85dd9](https://github.com/groupsky/ya-modbus/commit/ba85dd9518f85705bc3f87349b097f004a0e90a1)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)

### Features

- **cli:** add cross-validation for driver DEFAULT_CONFIG vs SUPPORTED_CONFIG ([#77](https://github.com/groupsky/ya-modbus/issues/77)) ([b904299](https://github.com/groupsky/ya-modbus/commit/b90429994fdd7a4a81605f74069773e84372ebb9)), closes [#56](https://github.com/groupsky/ya-modbus/issues/56)
- **cli:** add driver DEFAULT_CONFIG and SUPPORTED_CONFIG support ([#54](https://github.com/groupsky/ya-modbus/issues/54)) ([e6b4314](https://github.com/groupsky/ya-modbus/commit/e6b4314bf2b9339aeed9c94adedd8b2bcdfe89ea)), closes [#51](https://github.com/groupsky/ya-modbus/issues/51) [56-#60](https://github.com/56-/issues/60) [#51](https://github.com/groupsky/ya-modbus/issues/51)
- **cli:** Add interactive CLI tool for testing Modbus device drivers ([#17](https://github.com/groupsky/ya-modbus/issues/17)) ([0d86dd3](https://github.com/groupsky/ya-modbus/commit/0d86dd3da8ab391bf3246d3b01dc1457846b6301))
- **cli:** add Modbus RTU device discovery command ([#67](https://github.com/groupsky/ya-modbus/issues/67)) ([6ce339d](https://github.com/groupsky/ya-modbus/commit/6ce339d3d4d42a5af3502d4bb9754cae0b672940))
- **cli:** improve help organization with option and command groups ([#70](https://github.com/groupsky/ya-modbus/issues/70)) ([63b0dc0](https://github.com/groupsky/ya-modbus/commit/63b0dc0eebcc4cb6ee6cf5d79fc0f8d64d138eda))
- **cli:** unify driver loading with implicit local detection ([b3544d4](https://github.com/groupsky/ya-modbus/commit/b3544d4a83c58edba78a5e7440bdda410a72f52f)), closes [#76](https://github.com/groupsky/ya-modbus/issues/76)
- **drivers:** add multi-device driver support ([#75](https://github.com/groupsky/ya-modbus/issues/75)) ([eed4ed9](https://github.com/groupsky/ya-modbus/commit/eed4ed9f226453c9a5e1a782d0b89a52f324b85b))
- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([fcaf40a](https://github.com/groupsky/ya-modbus/commit/fcaf40a63452ecce09e82b397d448652354ecd16))
- **transport:** extract transport package for code reusability ([#102](https://github.com/groupsky/ya-modbus/issues/102)) ([b3153bf](https://github.com/groupsky/ya-modbus/commit/b3153bf7a05fdfcab41d896cfdac64fd2defe107)), closes [#107](https://github.com/groupsky/ya-modbus/issues/107) [#108](https://github.com/groupsky/ya-modbus/issues/108) [#109](https://github.com/groupsky/ya-modbus/issues/109) [#91](https://github.com/groupsky/ya-modbus/issues/91)
