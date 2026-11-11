# @ya-modbus/driver-sun2000

Huawei SUN2000 solar inverter driver for ya-modbus.

## Device Information

- **Manufacturer**: Huawei
- **Model**: SUN2000 (grid-tied solar inverter)
- **Communication**: Modbus TCP, holding registers (function code 03), big-endian, high word first for 32-bit values
- **Default Settings**:
  - Port: 502
  - Unit ID: 1

**One connection only.** The inverter accepts only one Modbus TCP connection at a time. Stop any other Modbus client (for example an old reader) before you connect.

**Unit ID.** The right unit ID depends on how the inverter is set up and connected; it is often 0 or 1. The driver default is 1, because the SDK describes the default address as 1-247. `SUPPORTED_CONFIG` allows 0 to 247. If the inverter does not answer on unit ID 1, try 0. The `ya-modbus` CLI always needs `--slave-id` with `--host`, so pass the unit ID there.

## Installation

```bash
npm install @ya-modbus/driver-sun2000
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-sun2000'
import { createTCPTransport } from '@ya-modbus/transport'

const transport = await createTCPTransport({
  host: 'inverter.local',
  port: DEFAULT_CONFIG.defaultPort,
  slaveId: DEFAULT_CONFIG.defaultAddress,
})

const driver = await createDriver({ transport, slaveId: DEFAULT_CONFIG.defaultAddress })

const values = await driver.readDataPoints(['active_power', 'daily_energy_yield'])
console.log(values)
```

## Data Points

All data points are read-only and are read on every poll.

| ID                      | Register    | Type, scale   | Unit |
| ----------------------- | ----------- | ------------- | ---- |
| `active_power`          | 32080-32081 | INT32, 0.001  | kW   |
| `reactive_power`        | 32082-32083 | INT32, 0.001  | kVAr |
| `power_factor`          | 32084       | INT16, 0.001  | -    |
| `grid_frequency`        | 32085       | UINT16, 0.01  | Hz   |
| `efficiency`            | 32086       | UINT16, 0.01  | %    |
| `internal_temperature`  | 32087       | INT16, 0.1    | °C   |
| `insulation_resistance` | 32088       | UINT16, 0.001 | MΩ   |
| `total_energy_yield`    | 32106-32107 | UINT32, 0.01  | kWh  |
| `daily_energy_yield`    | 32114-32115 | UINT32, 0.01  | kWh  |

The driver reads these registers in at most 3 requests per poll: 32080 (9 registers), 32106 (2) and 32114 (2). A block is read only when one of its data points is requested. The registers between the two energy counters (32108-32113) are not in the register list, so the driver does not read over them.

## Mapping from the old reader

The values are the same as in the old reader (same units and scale), only the names change.

| Old field | Data point              |
| --------- | ----------------------- |
| `ap`      | `active_power`          |
| `rp`      | `reactive_power`        |
| `pf`      | `power_factor`          |
| `freq`    | `grid_frequency`        |
| `eff`     | `efficiency`            |
| `temp`    | `internal_temperature`  |
| `ins`     | `insulation_resistance` |
| `total_p` | `total_energy_yield`    |
| `daily_p` | `daily_energy_yield`    |

## Differences from the old reader

- **Power factor and internal temperature are signed.** The old reader read them as unsigned 16-bit numbers, so a negative value came out as a large positive one (for example -0.9 became 64.636). The driver reads them as signed 16-bit numbers.
- **Energy counters above 2^31 stay positive.** The old reader joined the two words with the JavaScript `<<` operator, which works on signed 32-bit numbers. A counter of 2^31 or more (21474836.48 kWh) came out negative. The driver reads them as unsigned 32-bit numbers.

## Sources

- Huawei "Solar Inverter Modbus Interface Definitions" (register addresses, types and gains)
- The old SUN2000 reader in the homy project (field names and units)

## License

GPL-3.0-or-later
