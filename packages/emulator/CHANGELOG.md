# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.10.4](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/emulator@0.10.3...@ya-modbus/emulator@0.10.4) (2026-02-07)

### Bug Fixes

- **emulator:** reject TCP start() Promise on port binding errors ([#277](https://github.com/groupsky/ya-modbus/issues/277)) ([8bdfff2](https://github.com/groupsky/ya-modbus/commit/8bdfff24a93926ba9157cbedfd23b4c59b5acbbf)), closes [#274](https://github.com/groupsky/ya-modbus/issues/274) [#275](https://github.com/groupsky/ya-modbus/issues/275) [#276](https://github.com/groupsky/ya-modbus/issues/276) [#254](https://github.com/groupsky/ya-modbus/issues/254)

## [0.10.3](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/emulator@0.10.2...@ya-modbus/emulator@0.10.3) (2026-02-07)

### Bug Fixes

- **emulator:** remove event listeners in TCP/RTU transport stop() ([#270](https://github.com/groupsky/ya-modbus/issues/270)) ([8ce11a0](https://github.com/groupsky/ya-modbus/commit/8ce11a0a5ce5532be2a63bc1808e4ca83bbe19e8)), closes [#253](https://github.com/groupsky/ya-modbus/issues/253)

## [0.10.2](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/emulator@0.10.1...@ya-modbus/emulator@0.10.2) (2026-02-07)

**Note:** Version bump only for package @ya-modbus/emulator

## [0.10.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/emulator@0.10.0...@ya-modbus/emulator@0.10.1) (2026-02-07)

**Note:** Version bump only for package @ya-modbus/emulator

# [0.10.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/emulator@0.9.0...@ya-modbus/emulator@0.10.0) (2026-02-07)

### Features

- **emulator:** add configurable lock option for RTU transport ([#263](https://github.com/groupsky/ya-modbus/issues/263)) ([3e2a2f1](https://github.com/groupsky/ya-modbus/commit/3e2a2f195d6f7c14bb574aea1bb08f0ce38c23e7)), closes [#251](https://github.com/groupsky/ya-modbus/issues/251) [#264](https://github.com/groupsky/ya-modbus/issues/264) [#265](https://github.com/groupsky/ya-modbus/issues/265)

# [0.9.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/emulator@0.8.0...@ya-modbus/emulator@0.9.0) (2026-02-07)

### Features

- **emulator:** implement TCP transport ([#252](https://github.com/groupsky/ya-modbus/issues/252)) ([3df8fda](https://github.com/groupsky/ya-modbus/commit/3df8fdac2c279ca13fb314867daa2ffc32194481)), closes [#244](https://github.com/groupsky/ya-modbus/issues/244)

# [0.8.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/emulator@0.7.1...@ya-modbus/emulator@0.8.0) (2026-02-07)

### Features

- **emulator:** implement RTU transport using modbus-serial ([#243](https://github.com/groupsky/ya-modbus/issues/243)) ([71d0757](https://github.com/groupsky/ya-modbus/commit/71d0757bbbab9ae4e611c7e58baea85f2ca09501)), closes [#244](https://github.com/groupsky/ya-modbus/issues/244) [#245](https://github.com/groupsky/ya-modbus/issues/245) [#246](https://github.com/groupsky/ya-modbus/issues/246) [#247](https://github.com/groupsky/ya-modbus/issues/247) [#248](https://github.com/groupsky/ya-modbus/issues/248) [#249](https://github.com/groupsky/ya-modbus/issues/249) [#250](https://github.com/groupsky/ya-modbus/issues/250)

## [0.7.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/emulator@0.7.0...@ya-modbus/emulator@0.7.1) (2026-02-06)

**Note:** Version bump only for package @ya-modbus/emulator

# [0.7.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/emulator@0.6.0...@ya-modbus/emulator@0.7.0) (2026-01-11)

### Features

- **build:** add dual CommonJS/ESM package support ([#187](https://github.com/groupsky/ya-modbus/issues/187)) ([3d78130](https://github.com/groupsky/ya-modbus/commit/3d781304d42edba335cdc320ba25275f3b4ea6c9))

# 0.6.0 (2026-01-04)

### Bug Fixes

- **emulator:** use fake timers in timing tests to fix CI flakiness ([#156](https://github.com/groupsky/ya-modbus/issues/156)) ([67b7d8d](https://github.com/groupsky/ya-modbus/commit/67b7d8d5e889be50f504a0c764c26966be3ae711)), closes [#139](https://github.com/groupsky/ya-modbus/issues/139)
- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([e4ba4fd](https://github.com/groupsky/ya-modbus/commit/e4ba4fdc61c8695c3ab0b9504ef340d19861c599)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **release:** bump versions to 0.2.0 to bypass npm 24h block ([#148](https://github.com/groupsky/ya-modbus/issues/148)) ([aa2be6a](https://github.com/groupsky/ya-modbus/commit/aa2be6ae998f4443774b43507e7991601ec3068a))
- **release:** revert failed release and add missing publishConfig ([#147](https://github.com/groupsky/ya-modbus/issues/147)) ([60ea209](https://github.com/groupsky/ya-modbus/commit/60ea2091cbb350b0f474dc45d3ab33177b050764))
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([228ae2b](https://github.com/groupsky/ya-modbus/commit/228ae2b4da0c433e475825d068202efd3f0d3a5a)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)

### Features

- **emulator:** implement v0.1.0 with CLI, RTU transport, and timing behaviors ([#106](https://github.com/groupsky/ya-modbus/issues/106)) ([62c5edb](https://github.com/groupsky/ya-modbus/commit/62c5edb41b220a0ae012baaedee7f36ad4b2b8e7)), closes [#112](https://github.com/groupsky/ya-modbus/issues/112)
- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([3db7542](https://github.com/groupsky/ya-modbus/commit/3db7542ddbb7bb150b4deab50d5c96e5d668c852))

### Reverts

- Revert "chore(release): publish packages" ([a6d080d](https://github.com/groupsky/ya-modbus/commit/a6d080deeacf306f4911b6d78eab05dac8bfa7a7))

## [0.5.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/emulator@0.5.0...@ya-modbus/emulator@0.5.1) (2026-01-04)

**Note:** Version bump only for package @ya-modbus/emulator

# 0.5.0 (2026-01-04)

### Bug Fixes

- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([d3e027b](https://github.com/groupsky/ya-modbus/commit/d3e027bc75822d970f63733c4d069508a020122a)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **release:** bump versions to 0.2.0 to bypass npm 24h block ([#148](https://github.com/groupsky/ya-modbus/issues/148)) ([98d6fd6](https://github.com/groupsky/ya-modbus/commit/98d6fd666322fb647390d851c43ba0cd8a02486d))
- **release:** revert failed release and add missing publishConfig ([#147](https://github.com/groupsky/ya-modbus/issues/147)) ([8cbd4ba](https://github.com/groupsky/ya-modbus/commit/8cbd4baf9c140c8ef10080947ddd566014f32c77))
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([ba85dd9](https://github.com/groupsky/ya-modbus/commit/ba85dd9518f85705bc3f87349b097f004a0e90a1)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)

### Features

- **emulator:** implement v0.1.0 with CLI, RTU transport, and timing behaviors ([#106](https://github.com/groupsky/ya-modbus/issues/106)) ([894b180](https://github.com/groupsky/ya-modbus/commit/894b180546b270499a32e8ae916ca8ece91ece64)), closes [#112](https://github.com/groupsky/ya-modbus/issues/112)
- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([fcaf40a](https://github.com/groupsky/ya-modbus/commit/fcaf40a63452ecce09e82b397d448652354ecd16))

### Reverts

- Revert "chore(release): publish packages" ([b613837](https://github.com/groupsky/ya-modbus/commit/b6138375978fdebfd57e645367f3fc8011f0452f))
