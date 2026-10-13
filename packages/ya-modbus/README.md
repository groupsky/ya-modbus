# ya-modbus

Short name for [@ya-modbus/cli](https://github.com/groupsky/ya-modbus/tree/main/packages/cli#readme), so you can run it with a plain `npx ya-modbus`.

```bash
npx ya-modbus --help
```

This package only contains a launcher. It depends on `@ya-modbus/cli` and runs its `ya-modbus` command. Options, examples and documentation are in the [@ya-modbus/cli README](https://github.com/groupsky/ya-modbus/tree/main/packages/cli#readme).

## Global install

```bash
npm install -g ya-modbus
```

Install either `ya-modbus` or `@ya-modbus/cli` globally, not both. Both provide the `ya-modbus` command, so npm reports a conflict.
