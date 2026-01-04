# ya-modbus-driver-xymd1

XYMD1 Temperature and Humidity Sensor driver for ya-modbus.

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

// Calibrate sensor (applied immediately)
await driver.writeDataPoint('temperature_correction', -1.5)
await driver.writeDataPoint('humidity_correction', 2.0)
```

### Using Default Configuration

The driver exports a `DEFAULT_CONFIG` constant with factory-default device settings:

```typescript
import { createDriver, DEFAULT_CONFIG } from 'ya-modbus-driver-xymd1'
import { ModbusRTU } from '@ya-modbus/transport-rtu'

// Use default configuration for connecting to factory-default device
const transport = new ModbusRTU({
  path: '/dev/ttyUSB0',
  baudRate: DEFAULT_CONFIG.baudRate, // 9600
  parity: DEFAULT_CONFIG.parity, // 'even'
  dataBits: DEFAULT_CONFIG.dataBits, // 8
  stopBits: DEFAULT_CONFIG.stopBits, // 1
})

const driver = await createDriver({
  transport,
  slaveId: DEFAULT_CONFIG.defaultAddress, // 1
})
```

This ensures your code always uses the correct factory defaults and makes it easier to update if device specifications change.

## Data Points

| ID                       | Name                   | Type    | Unit | Access     | Description                                                                                |
| ------------------------ | ---------------------- | ------- | ---- | ---------- | ------------------------------------------------------------------------------------------ |
| `temperature`            | Temperature            | float   | °C   | Read-only  | Temperature in degrees Celsius                                                             |
| `humidity`               | Relative Humidity      | float   | %    | Read-only  | Relative humidity percentage (0-100%)                                                      |
| `device_address`         | Device Address         | integer | -    | Read-write | Modbus device address (1-247). Changes applied after device restart.                       |
| `baud_rate`              | Baud Rate              | enum    | -    | Read-write | Serial communication baud rate (9600, 14400, 19200). Changes applied after device restart. |
| `temperature_correction` | Temperature Correction | float   | °C   | Read-write | Temperature correction offset (-10.0 to +10.0°C). Applied immediately.                     |
| `humidity_correction`    | Humidity Correction    | float   | %    | Read-write | Humidity correction offset (-10.0 to +10.0%RH). Applied immediately.                       |

## Register Mapping

| Function      | Register | Type    | Format          | Description                                |
| ------------- | -------- | ------- | --------------- | ------------------------------------------ |
| Read          | 1-2      | Input   | 16-bit × 2      | Temperature and humidity (×10)             |
| Configuration | 0x101    | Holding | 16-bit unsigned | Device address (1-247)                     |
| Configuration | 0x102    | Holding | 16-bit unsigned | Baud rate setting                          |
| Calibration   | 0x103    | Holding | 16-bit signed   | Temperature correction (×10, -100 to +100) |
| Calibration   | 0x104    | Holding | 16-bit signed   | Humidity correction (×10, -100 to +100)    |

## Calibration

The XYMD01 supports temperature and humidity correction to calibrate sensor readings against reference measurements.

### Using the Driver API

```typescript
// Example: Calibrate temperature
// 1. Measure actual temperature with reference device: 23.0°C
// 2. Read XYMD01 sensor: 25.5°C
// 3. Calculate correction: 23.0 - 25.5 = -2.5°C

await driver.writeDataPoint('temperature_correction', -2.5)

// Verify corrected reading
const temp = await driver.readDataPoint('temperature')
// temp should now be approximately 23.0°C

// Example: Calibrate humidity
await driver.writeDataPoint('humidity_correction', 1.5)
```

### Using the CLI

```bash
# Set temperature correction
ya-modbus write \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
  --data-point temperature_correction \
  --value -2.5 \
  --yes \
  --verify

# Set humidity correction
ya-modbus write \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
  --data-point humidity_correction \
  --value 1.5 \
  --yes \
  --verify

# Read all values including corrections
ya-modbus read \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
  --all
```

### Notes

- Corrections are applied **immediately** (no device restart required)
- Values are stored in device holding registers and **persist across power cycles**
- Correction range: -10.0 to +10.0 for both temperature (°C) and humidity (%RH)
- The corrected values are reflected in the temperature and humidity input registers

## License

GPL-3.0-or-later
