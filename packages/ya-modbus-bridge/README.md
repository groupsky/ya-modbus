# ya-modbus-bridge

Short name for [@ya-modbus/mqtt-bridge](https://github.com/groupsky/ya-modbus/tree/main/packages/mqtt-bridge#readme), so you can run it with a plain `npx ya-modbus-bridge`.

```bash
npx ya-modbus-bridge --help
```

This package only contains a launcher. It depends on `@ya-modbus/mqtt-bridge` and runs its `ya-modbus-bridge` command. Options, examples and documentation are in the [@ya-modbus/mqtt-bridge README](https://github.com/groupsky/ya-modbus/tree/main/packages/mqtt-bridge#readme).

## Global install

```bash
npm install -g ya-modbus-bridge
```

Install either `ya-modbus-bridge` or `@ya-modbus/mqtt-bridge` globally, not both. Both provide the `ya-modbus-bridge` command, so npm reports a conflict.
