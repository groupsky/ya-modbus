---
name: New driver request
about: Request support for a new Modbus device
title: 'driver: [Device Name]'
labels: enhancement, driver
assignees: ''
---

## Device information

- **Manufacturer**:
- **Model**:
- **Device type** (e.g., energy meter, temperature sensor, inverter):

## Register documentation

Provide one of the following:

- [ ] Link to official Modbus register map / datasheet
- [ ] Attached PDF documentation
- [ ] Register list below

<details>
<summary>Register list (if no documentation available)</summary>

| Register | Type    | Description      | Unit | Scale |
| -------- | ------- | ---------------- | ---- | ----- |
| 0x0000   | holding | Example register | kWh  | 0.01  |

</details>

## Device defaults

If known, provide the factory defaults:

- **Default slave ID**:
- **Default baud rate**:
- **Default parity**: (none/even/odd)
- **Default stop bits**:

## Device limitations

List any known limitations:

- [ ] Maximum registers per read request:
- [ ] Forbidden/reserved register ranges:
- [ ] Required delays between requests:
- [ ] Other quirks or limitations:

## Device profile (recommended)

Use the `ya-modbus-profile` CLI to scan your device and attach the generated profile:

```bash
npx @ya-modbus/device-profiler --port /dev/ttyUSB0 --slave-id 1 --output profile.json
```

- [ ] Device profile attached

## Additional context

Any other information that might help (photos, usage notes, etc.)
