# ya-modbus-driver-xymd1

XYMD1 Temperature and Humidity Sensor driver for ya-modbus-mqtt-bridge.

## Device Information

- **Model**: XY-MD1
- **Type**: Temperature and Humidity Sensor
- **Communication**: Modbus RTU
- **Default Settings**:
  - Address: 1
  - Baud rate: 9600
  - Parity: Even
  - Stop bits: 1
  - Data bits: 8

## Installation

```bash
npm install ya-modbus-driver-xymd1
```

## Usage

```typescript
import { createDriver } from 'ya-modbus-driver-xymd1'
import { ModbusRTU } from '@ya-modbus/transport-rtu'

// Create transport
const transport = new ModbusRTU({
  path: '/dev/ttyUSB0',
  baudRate: 9600,
  parity: 'even',
})

// Create driver
const driver = await createDriver({
  transport,
  slaveId: 1,
})

// Read temperature and humidity
const values = await driver.readDataPoints(['temperature', 'humidity'])
console.log(values)
// { temperature: 24.5, humidity: 65.2 }

// Read current device configuration
const currentAddress = await driver.readDataPoint('device_address')
const currentBaudRate = await driver.readDataPoint('baud_rate')
console.log(`Current config: address=${currentAddress}, baudRate=${currentBaudRate}`)

// Configure device address (requires device restart to take effect)
await driver.writeDataPoint('device_address', 5)

// Configure baud rate (requires device restart to take effect)
await driver.writeDataPoint('baud_rate', 19200)
```

## Data Points

| ID               | Name              | Type    | Unit | Access     | Description                                                                                            |
| ---------------- | ----------------- | ------- | ---- | ---------- | ------------------------------------------------------------------------------------------------------ |
| `temperature`    | Temperature       | float   | °C   | Read-only  | Temperature in degrees Celsius                                                                         |
| `humidity`       | Relative Humidity | float   | %    | Read-only  | Relative humidity percentage (0-100%)                                                                  |
| `device_address` | Device Address    | integer | -    | Read-write | Modbus device address (1-247). Changes applied after device restart.                                   |
| `baud_rate`      | Baud Rate         | enum    | -    | Read-write | Serial communication baud rate (2400, 4800, 9600, 19200, 38400). Changes applied after device restart. |

## Register Mapping

| Function      | Register | Type    | Format     | Description                    |
| ------------- | -------- | ------- | ---------- | ------------------------------ |
| Read          | 1-2      | Input   | 16-bit × 2 | Temperature and humidity (×10) |
| Configuration | 0x101    | Holding | 16-bit     | Device address (1-247)         |
| Configuration | 0x102    | Holding | 16-bit     | Baud rate setting              |

## License

GPL-3.0-or-later
