# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.3.0 (2026-01-04)

### Bug Fixes

- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([d3e027b](https://github.com/groupsky/ya-modbus/commit/d3e027bc75822d970f63733c4d069508a020122a)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **release:** bump versions to 0.2.0 to bypass npm 24h block ([#148](https://github.com/groupsky/ya-modbus/issues/148)) ([98d6fd6](https://github.com/groupsky/ya-modbus/commit/98d6fd666322fb647390d851c43ba0cd8a02486d))
- **release:** revert failed release and add missing publishConfig ([#147](https://github.com/groupsky/ya-modbus/issues/147)) ([8cbd4ba](https://github.com/groupsky/ya-modbus/commit/8cbd4baf9c140c8ef10080947ddd566014f32c77))
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([ba85dd9](https://github.com/groupsky/ya-modbus/commit/ba85dd9518f85705bc3f87349b097f004a0e90a1)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)
- resolve ESLint configuration and linting errors ([1b782db](https://github.com/groupsky/ya-modbus/commit/1b782dbc9f2b4393987d34e49360db9a33633ddc))
- use tsc --build and add composite to all packages ([03b9752](https://github.com/groupsky/ya-modbus/commit/03b9752a8dae38ef40878f68c8f7d085a562c830))

### Features

- add Dependabot with auto-merge and optimize dependencies ([5386e2d](https://github.com/groupsky/ya-modbus/commit/5386e2deda665ee5491f45b092d7d1eecf7be0ed))
- add XYMD1 temperature/humidity sensor driver ([64404e9](https://github.com/groupsky/ya-modbus/commit/64404e9dd838aa6f6c4589c0997bfbd7bdd52ce1))
- **cli:** add driver DEFAULT_CONFIG and SUPPORTED_CONFIG support ([#54](https://github.com/groupsky/ya-modbus/issues/54)) ([e6b4314](https://github.com/groupsky/ya-modbus/commit/e6b4314bf2b9339aeed9c94adedd8b2bcdfe89ea)), closes [#51](https://github.com/groupsky/ya-modbus/issues/51) [56-#60](https://github.com/56-/issues/60) [#51](https://github.com/groupsky/ya-modbus/issues/51)
- **cli:** Add interactive CLI tool for testing Modbus device drivers ([#17](https://github.com/groupsky/ya-modbus/issues/17)) ([0d86dd3](https://github.com/groupsky/ya-modbus/commit/0d86dd3da8ab391bf3246d3b01dc1457846b6301))
- **driver-types:** add standard types for driver DEFAULT_CONFIG and SUPPORTED_CONFIG ([#52](https://github.com/groupsky/ya-modbus/issues/52)) ([6517c23](https://github.com/groupsky/ya-modbus/commit/6517c2311005b3bb82e21393599c8ec4fe477cda)), closes [#51](https://github.com/groupsky/ya-modbus/issues/51) [#48](https://github.com/groupsky/ya-modbus/issues/48) [#49](https://github.com/groupsky/ya-modbus/issues/49) [#50](https://github.com/groupsky/ya-modbus/issues/50) [#51](https://github.com/groupsky/ya-modbus/issues/51)
- **drivers:** add multi-device driver support ([#75](https://github.com/groupsky/ya-modbus/issues/75)) ([eed4ed9](https://github.com/groupsky/ya-modbus/commit/eed4ed9f226453c9a5e1a782d0b89a52f324b85b))
- **drivers:** add NOARK Ex9EM energy meter driver ([#79](https://github.com/groupsky/ya-modbus/issues/79)) ([4f8133a](https://github.com/groupsky/ya-modbus/commit/4f8133a9352a8a0ce89ee7d0c2247fc4484eb0f0))
- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([fcaf40a](https://github.com/groupsky/ya-modbus/commit/fcaf40a63452ecce09e82b397d448652354ecd16))
- **transport:** extract transport package for code reusability ([#102](https://github.com/groupsky/ya-modbus/issues/102)) ([b3153bf](https://github.com/groupsky/ya-modbus/commit/b3153bf7a05fdfcab41d896cfdac64fd2defe107)), closes [#107](https://github.com/groupsky/ya-modbus/issues/107) [#108](https://github.com/groupsky/ya-modbus/issues/108) [#109](https://github.com/groupsky/ya-modbus/issues/109) [#91](https://github.com/groupsky/ya-modbus/issues/91)

### Reverts

- Revert "chore(release): publish packages" ([b613837](https://github.com/groupsky/ya-modbus/commit/b6138375978fdebfd57e645367f3fc8011f0452f))

# [0.2.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-types@0.1.0...@ya-modbus/driver-types@0.2.0) (2026-01-04)

### Bug Fixes

- **release:** revert failed release and add missing publishConfig ([#147](https://github.com/groupsky/ya-modbus/issues/147)) ([8cbd4ba](https://github.com/groupsky/ya-modbus/commit/8cbd4baf9c140c8ef10080947ddd566014f32c77))

### Reverts

- Revert "chore(release): publish packages" ([b0b722e](https://github.com/groupsky/ya-modbus/commit/b0b722e686f0466b2e2c58df4b1539a634b0fe12))
- Revert "chore(release): publish packages" ([b613837](https://github.com/groupsky/ya-modbus/commit/b6138375978fdebfd57e645367f3fc8011f0452f))
