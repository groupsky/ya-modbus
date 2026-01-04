# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.1.0 (2026-01-04)

### Bug Fixes

- add explicit this typing to readDataPoints method ([ff9938c](https://github.com/groupsky/ya-modbus/commit/ff9938cc24c4993dbb117f383e9e270ae989478e))
- **driver-xymd1:** fix batch read for device configuration registers ([bb87297](https://github.com/groupsky/ya-modbus/commit/bb872970ef4cdea569d31e841d34df3f05fcbd07))
- **driver-xymd1:** update valid baud rates to 9600, 14400, and 19200 ([#47](https://github.com/groupsky/ya-modbus/issues/47)) ([d4460ed](https://github.com/groupsky/ya-modbus/commit/d4460ed8dfbf8312cc87fee994a94e7b5a94bdbb))
- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([d3e027b](https://github.com/groupsky/ya-modbus/commit/d3e027bc75822d970f63733c4d069508a020122a)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **release:** revert failed release and add missing publishConfig ([#147](https://github.com/groupsky/ya-modbus/issues/147)) ([8cbd4ba](https://github.com/groupsky/ya-modbus/commit/8cbd4baf9c140c8ef10080947ddd566014f32c77))
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([ba85dd9](https://github.com/groupsky/ya-modbus/commit/ba85dd9518f85705bc3f87349b097f004a0e90a1)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)
- remove redundant type annotations to fix type inference ([9f79003](https://github.com/groupsky/ya-modbus/commit/9f79003fd2e69b2923bdf867dddd8451e07f4bad))
- resolve ESLint configuration and linting errors ([1b782db](https://github.com/groupsky/ya-modbus/commit/1b782dbc9f2b4393987d34e49360db9a33633ddc))
- restore accidentally deleted ya-modbus-driver-xymd1 package.json ([4c507ef](https://github.com/groupsky/ya-modbus/commit/4c507ef90693014d3c732d85448d560843ab4bfc))
- use tsc --build and add composite to all packages ([03b9752](https://github.com/groupsky/ya-modbus/commit/03b9752a8dae38ef40878f68c8f7d085a562c830))

### Features

- add Dependabot with auto-merge and optimize dependencies ([5386e2d](https://github.com/groupsky/ya-modbus/commit/5386e2deda665ee5491f45b092d7d1eecf7be0ed))
- add XYMD1 temperature/humidity sensor driver ([64404e9](https://github.com/groupsky/ya-modbus/commit/64404e9dd838aa6f6c4589c0997bfbd7bdd52ce1))
- **cli:** Add interactive CLI tool for testing Modbus device drivers ([#17](https://github.com/groupsky/ya-modbus/issues/17)) ([0d86dd3](https://github.com/groupsky/ya-modbus/commit/0d86dd3da8ab391bf3246d3b01dc1457846b6301))
- **driver-sdk:** add reusable utilities for driver development ([#82](https://github.com/groupsky/ya-modbus/issues/82)) ([c018007](https://github.com/groupsky/ya-modbus/commit/c018007aeb082941f60c5aac5cc36d9490a49758))
- **driver-types:** add standard types for driver DEFAULT_CONFIG and SUPPORTED_CONFIG ([#52](https://github.com/groupsky/ya-modbus/issues/52)) ([6517c23](https://github.com/groupsky/ya-modbus/commit/6517c2311005b3bb82e21393599c8ec4fe477cda)), closes [#51](https://github.com/groupsky/ya-modbus/issues/51) [#48](https://github.com/groupsky/ya-modbus/issues/48) [#49](https://github.com/groupsky/ya-modbus/issues/49) [#50](https://github.com/groupsky/ya-modbus/issues/50) [#51](https://github.com/groupsky/ya-modbus/issues/51)
- **driver-xymd1:** add DEFAULT_CONFIG constant export ([#49](https://github.com/groupsky/ya-modbus/issues/49)) ([030f9de](https://github.com/groupsky/ya-modbus/commit/030f9de94078405c5474debab2911fa61ffeff42)), closes [#48](https://github.com/groupsky/ya-modbus/issues/48)
- **driver-xymd1:** add temperature and humidity correction registers ([#44](https://github.com/groupsky/ya-modbus/issues/44)) ([e292e78](https://github.com/groupsky/ya-modbus/commit/e292e789557133a400f4b60e87696e354155d1bd))
- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([fcaf40a](https://github.com/groupsky/ya-modbus/commit/fcaf40a63452ecce09e82b397d448652354ecd16))

### Reverts

- Revert "chore(release): publish packages" ([b613837](https://github.com/groupsky/ya-modbus/commit/b6138375978fdebfd57e645367f3fc8011f0452f))
