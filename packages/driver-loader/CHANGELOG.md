# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.11.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-loader@0.11.0...@ya-modbus/driver-loader@0.11.1) (2026-10-12)

### Bug Fixes

- **cli:** use current @ya-modbus/driver-* names in help and docs ([#577](https://github.com/groupsky/ya-modbus/issues/577)) ([6367875](https://github.com/groupsky/ya-modbus/commit/6367875ee3a19540624bd3130d18c1787c1b7921)), closes [#566](https://github.com/groupsky/ya-modbus/issues/566)

# [0.11.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-loader@0.10.0...@ya-modbus/driver-loader@0.11.0) (2026-10-12)

### Features

- **driver-loader:** load local drivers from their package.json entry point ([#581](https://github.com/groupsky/ya-modbus/issues/581)) ([177bb89](https://github.com/groupsky/ya-modbus/commit/177bb89eab449a4ed55fe7ce37695e314cfdd358)), closes [#24](https://github.com/groupsky/ya-modbus/issues/24)

# [0.10.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-loader@0.9.0...@ya-modbus/driver-loader@0.10.0) (2026-10-12)

### Features

- **driver-loader:** resolve short driver names ([#580](https://github.com/groupsky/ya-modbus/issues/580)) ([1050ab8](https://github.com/groupsky/ya-modbus/commit/1050ab8cb51d73826bf72eb2a10a31bffc98d8a7)), closes [#151](https://github.com/groupsky/ya-modbus/issues/151)

# [0.9.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-loader@0.8.1...@ya-modbus/driver-loader@0.9.0) (2026-10-12)

### Features

- **driver-loader:** allow scoped third-party driver packages ([#573](https://github.com/groupsky/ya-modbus/issues/573)) ([63b2b83](https://github.com/groupsky/ya-modbus/commit/63b2b833dbb0b5198e8df7135f419793e32d95c3)), closes [#565](https://github.com/groupsky/ya-modbus/issues/565)

## [0.8.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-loader@0.8.0...@ya-modbus/driver-loader@0.8.1) (2026-10-12)

### Bug Fixes

- **cli:** read CLI versions from package.json in ESM and CJS builds ([#539](https://github.com/groupsky/ya-modbus/issues/539)) ([f3275f3](https://github.com/groupsky/ya-modbus/commit/f3275f3ab3c0f4019304ca7abb0f0fdecc6faf11)), closes [#256](https://github.com/groupsky/ya-modbus/issues/256)

# [0.8.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-loader@0.7.2...@ya-modbus/driver-loader@0.8.0) (2026-10-12)

- feat!: drop Node.js 20 support (#516) ([70002ab](https://github.com/groupsky/ya-modbus/commit/70002ab28155432e0984c67a70d1469fc5be7cb3)), closes [#516](https://github.com/groupsky/ya-modbus/issues/516)

### BREAKING CHANGES

- Node.js 20 is no longer supported. Use Node.js 22 or 24.

## [0.7.2](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-loader@0.7.1...@ya-modbus/driver-loader@0.7.2) (2026-10-12)

**Note:** Version bump only for package @ya-modbus/driver-loader

## [0.7.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-loader@0.7.0...@ya-modbus/driver-loader@0.7.1) (2026-02-06)

**Note:** Version bump only for package @ya-modbus/driver-loader

# [0.7.0](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-loader@0.6.0...@ya-modbus/driver-loader@0.7.0) (2026-01-11)

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

### Reverts

- Revert "chore(release): publish packages" ([a6d080d](https://github.com/groupsky/ya-modbus/commit/a6d080deeacf306f4911b6d78eab05dac8bfa7a7))

## [0.5.1](https://github.com/groupsky/ya-modbus/compare/@ya-modbus/driver-loader@0.5.0...@ya-modbus/driver-loader@0.5.1) (2026-01-04)

**Note:** Version bump only for package @ya-modbus/driver-loader

# 0.5.0 (2026-01-04)

### Bug Fixes

- enable linting without build and fix monorepo build order ([#129](https://github.com/groupsky/ya-modbus/issues/129)) ([d3e027b](https://github.com/groupsky/ya-modbus/commit/d3e027bc75822d970f63733c4d069508a020122a)), closes [#130](https://github.com/groupsky/ya-modbus/issues/130)
- **release:** bump versions to 0.2.0 to bypass npm 24h block ([#148](https://github.com/groupsky/ya-modbus/issues/148)) ([98d6fd6](https://github.com/groupsky/ya-modbus/commit/98d6fd666322fb647390d851c43ba0cd8a02486d))
- **release:** revert failed release and add missing publishConfig ([#147](https://github.com/groupsky/ya-modbus/issues/147)) ([8cbd4ba](https://github.com/groupsky/ya-modbus/commit/8cbd4baf9c140c8ef10080947ddd566014f32c77))
- **release:** revert failed release and cleanup tags ([#145](https://github.com/groupsky/ya-modbus/issues/145)) ([ba85dd9](https://github.com/groupsky/ya-modbus/commit/ba85dd9518f85705bc3f87349b097f004a0e90a1)), closes [#143](https://github.com/groupsky/ya-modbus/issues/143) [#144](https://github.com/groupsky/ya-modbus/issues/144)

### Features

- **release:** add Lerna-Lite publishing with pre-release support ([#135](https://github.com/groupsky/ya-modbus/issues/135)) ([fcaf40a](https://github.com/groupsky/ya-modbus/commit/fcaf40a63452ecce09e82b397d448652354ecd16))

### Reverts

- Revert "chore(release): publish packages" ([b613837](https://github.com/groupsky/ya-modbus/commit/b6138375978fdebfd57e645367f3fc8011f0452f))
