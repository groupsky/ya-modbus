# ya-modbus-emulator

Short name for [@ya-modbus/emulator](https://github.com/groupsky/ya-modbus/tree/main/packages/emulator#readme), so you can run it with a plain `npx ya-modbus-emulator`.

```bash
npx ya-modbus-emulator --help
```

This package only contains a launcher. It depends on `@ya-modbus/emulator` and runs its `ya-modbus-emulator` command. Options, examples and documentation are in the [@ya-modbus/emulator README](https://github.com/groupsky/ya-modbus/tree/main/packages/emulator#readme).

## Global install

```bash
npm install -g ya-modbus-emulator
```

Install either `ya-modbus-emulator` or `@ya-modbus/emulator` globally, not both. Both provide the `ya-modbus-emulator` command, so npm reports a conflict.
