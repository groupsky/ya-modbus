# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.7.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-sdk@0.7.0...@ya-modbus/driver-sdk@0.7.1) (2026-02-06)

**Note:** Version bump only for package @ya-modbus/driver-sdk

# [0.7.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-sdk@0.6.0...@ya-modbus/driver-sdk@0.7.0) (2026-01-11)

### Features

- **build:** add dual CommonJS/ESM package support ([#187](https://github.com/groupsky/ya-modbus/issues/187)) ([3d78130](https://github.com/groupsky/ya-modbus/commit/3d781304d42edba335cdc320ba25275f3b4ea6c9))
- **driver:** add ORNO OR-WE-516 3-phase energy meter driver ([#162](https://github.com/groupsky/ya-modbus/issues/162)) ([8d63837](https://github.com/groupsky/ya-modbus/commit/8d63837d7816791f5ce76cf3dcbf70dc61502037))

# 0.6.0 (2026-01-04)

### Bug Fixes

- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([e4ba4fd](https://github.com/groupsky/ya-modbus/commit/e4ba4fdc61c8695c3ab0b9504ef340d19861c599)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **release:** bump versions to 0.2.0 to bypass npm 24h block ([#148](https://github.com/groupsky/ya-modbus/issues/148)) ([aa2be6a](https://github.com/groupsky/ya-modbus/commit/aa2be6ae998f4443774b43507e7991601ec3068a))
- **release:** revert failed release and add missing publishConfig ([#147](https://github.com/groupsky/ya-modbus/issues/147)) ([60ea209](https://github.com/groupsky/ya-modbus/commit/60ea2091cbb350b0f474dc45d3ab33177b050764))
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([228ae2b](https://github.com/groupsky/ya-modbus/commit/228ae2b4da0c433e475825d068202efd3f0d3a5a)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)
- use tsc --build and add composite to all packages ([6001bfa](https://github.com/groupsky/ya-modbus/commit/6001bfa77c6dd87930604b0e7eb6c342991b3988))

### Features

- add Dependabot with auto-merge and optimize dependencies ([790b31a](https://github.com/groupsky/ya-modbus/commit/790b31aa3282df56517d6d07052204b65c061cdc))
- add XYMD1 temperature/humidity sensor driver ([b657fc9](https://github.com/groupsky/ya-modbus/commit/b657fc9d142a1b7dcf0f0d82b53b415b5ed7f51a))
- **driver-sdk:** add reusable utilities for driver development ([#82](https://github.com/groupsky/ya-modbus/issues/82)) ([5283b8e](https://github.com/groupsky/ya-modbus/commit/5283b8ed36ab95f5f0719dd517f31e4ce6aeef09))
- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([3db7542](https://github.com/groupsky/ya-modbus/commit/3db7542ddbb7bb150b4deab50d5c96e5d668c852))
- **transport:** extract transport package for code reusability ([#102](https://github.com/groupsky/ya-modbus/issues/102)) ([aea6946](https://github.com/groupsky/ya-modbus/commit/aea6946b40f502ff630c7a0ec599088899c30a90)), closes [#107](https://github.com/groupsky/ya-modbus/issues/107) [#108](https://github.com/groupsky/ya-modbus/issues/108) [#109](https://github.com/groupsky/ya-modbus/issues/109) [#91](https://github.com/groupsky/ya-modbus/issues/91)

### Reverts

- Revert "chore(release): publish packages" ([a6d080d](https://github.com/groupsky/ya-modbus/commit/a6d080deeacf306f4911b6d78eab05dac8bfa7a7))

## [0.5.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-sdk@0.5.0...@ya-modbus/driver-sdk@0.5.1) (2026-01-04)

**Note:** Version bump only for package @ya-modbus/driver-sdk

# 0.5.0 (2026-01-04)

### Bug Fixes

- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([d3e027b](https://github.com/groupsky/ya-modbus/commit/d3e027bc75822d970f63733c4d069508a020122a)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **release:** bump versions to 0.2.0 to bypass npm 24h block ([#148](https://github.com/groupsky/ya-modbus/issues/148)) ([98d6fd6](https://github.com/groupsky/ya-modbus/commit/98d6fd666322fb647390d851c43ba0cd8a02486d))
- **release:** revert failed release and add missing publishConfig ([#147](https://github.com/groupsky/ya-modbus/issues/147)) ([8cbd4ba](https://github.com/groupsky/ya-modbus/commit/8cbd4baf9c140c8ef10080947ddd566014f32c77))
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([ba85dd9](https://github.com/groupsky/ya-modbus/commit/ba85dd9518f85705bc3f87349b097f004a0e90a1)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)
- use tsc --build and add composite to all packages ([03b9752](https://github.com/groupsky/ya-modbus/commit/03b9752a8dae38ef40878f68c8f7d085a562c830))

### Features

- add Dependabot with auto-merge and optimize dependencies ([5386e2d](https://github.com/groupsky/ya-modbus/commit/5386e2deda665ee5491f45b092d7d1eecf7be0ed))
- add XYMD1 temperature/humidity sensor driver ([64404e9](https://github.com/groupsky/ya-modbus/commit/64404e9dd838aa6f6c4589c0997bfbd7bdd52ce1))
- **driver-sdk:** add reusable utilities for driver development ([#82](https://github.com/groupsky/ya-modbus/issues/82)) ([c018007](https://github.com/groupsky/ya-modbus/commit/c018007aeb082941f60c5aac5cc36d9490a49758))
- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([fcaf40a](https://github.com/groupsky/ya-modbus/commit/fcaf40a63452ecce09e82b397d448652354ecd16))
- **transport:** extract transport package for code reusability ([#102](https://github.com/groupsky/ya-modbus/issues/102)) ([b3153bf](https://github.com/groupsky/ya-modbus/commit/b3153bf7a05fdfcab41d896cfdac64fd2defe107)), closes [#107](https://github.com/groupsky/ya-modbus/issues/107) [#108](https://github.com/groupsky/ya-modbus/issues/108) [#109](https://github.com/groupsky/ya-modbus/issues/109) [#91](https://github.com/groupsky/ya-modbus/issues/91)

### Reverts

- Revert "chore(release): publish packages" ([b613837](https://github.com/groupsky/ya-modbus/commit/b6138375978fdebfd57e645367f3fc8011f0452f))
