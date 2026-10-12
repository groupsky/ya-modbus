# ya-modbus-profile

Short name for [@ya-modbus/device-profiler](https://github.com/groupsky/ya-modbus/tree/main/packages/device-profiler#readme), so you can run it with a plain `npx ya-modbus-profile`.

```bash
npx ya-modbus-profile --help
```

This package only contains a launcher. It depends on `@ya-modbus/device-profiler` and runs its `ya-modbus-profile` command. Options, examples and documentation are in the [@ya-modbus/device-profiler README](https://github.com/groupsky/ya-modbus/tree/main/packages/device-profiler#readme).

## Global install

```bash
npm install -g ya-modbus-profile
```

Install either `ya-modbus-profile` or `@ya-modbus/device-profiler` globally, not both. Both provide the `ya-modbus-profile` command, so npm reports a conflict.
