# Emulator Package - Development Guide

Software Modbus device emulator for testing drivers without physical hardware.

## Purpose

Simulate realistic Modbus devices with configurable behaviors (timing, constraints, errors) to enable:

- Testing device drivers without hardware
- Simulating edge cases and error conditions
- Accelerating test cycles with deterministic behavior
- Supporting driver development workflows

## Key Concepts

- **Realistic timing**: Simulates polling intervals, processing delays, transmission delays
- **Register constraints**: Forbidden ranges, batch size limits
- **Error injection**: Timeouts, CRC errors, exceptions
- **Multiple transports**: TCP, RTU (virtual/real serial), Memory (for unit tests)
- **Custom function codes**: Support vendor-specific Modbus extensions

## Architecture

Core classes:

- `ModbusEmulator`: Main emulator managing devices and transport
- `EmulatedDevice`: Individual device with registers and behaviors
- Transport implementations: BaseTransport → TcpTransport, RtuTransport, MemoryTransport
- Behavior modules: Timing, Constraints, Errors, FunctionCodes

## Testing

- TDD approach: Write tests first, then implement
- Unit tests: Core logic (register storage, timing calculations, constraints)
- Integration tests: End-to-end communication scenarios
- Target: 95% coverage across all metrics

## Common Tasks

- Adding new function codes: Extend function-codes.ts handlers
- Transport implementation: Extend BaseTransport abstract class
- Behavior modification: Update timing.ts, constraints.ts, errors.ts
- Test patterns: See plan for test structure examples
