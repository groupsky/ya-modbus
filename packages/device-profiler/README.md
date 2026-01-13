# @ya-modbus/device-profiler

Device profiler for discovering Modbus register maps through automated scanning.

## Features

- Scans holding registers (FC03) and input registers (FC04)
- Batch reading with automatic fallback on errors
- Real-time progress display
- Timing measurement for each read operation
- Error classification (timeout, CRC, Modbus exceptions)
- Summary table of discovered registers

## Installation

```bash
npm install @ya-modbus/device-profiler
```

## Usage

### CLI

```bash
ya-modbus-profile --port /dev/ttyUSB0 --slave-id 1 --baud 9600
```

Options:

- `--port` - Serial port or TCP host:port
- `--slave-id` - Modbus slave ID
- `--baud` - Baud rate for RTU (default: 9600)
- `--start` - Start register address (default: 0)
- `--end` - End register address (default: 100)
- `--batch` - Batch size for reads (default: 10)

### Programmatic

<!-- embedme examples/api-examples.ts#L8-L20 -->

```ts
    transport,
    type: RegisterType.Holding,
    startAddress: 0,
    endAddress: 100,
    batchSize: 10,
    onProgress: (current, total) => {
      console.log(`${current}/${total}`)
    },
    onResult: (result) => {
      console.log(result)
    },
  })
}
```

## Output

The scanner produces a summary showing:

- Register address
- Register type (holding/input)
- Read success/failure
- Response time
- Error details (if any)

## License

GPL-3.0-or-later
