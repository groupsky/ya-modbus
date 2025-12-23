# AGENTS.md Maintenance Guide

**Required reading before updating any AGENTS.md file in this project.**

## Core Principles

### 1. No Common Knowledge

AGENTS.md files are for **project-specific** information only.

**Don't include**:
- How TypeScript works
- What npm is
- General testing concepts
- Common design patterns (unless applied uniquely)
- Standard Git workflows

**Do include**:
- Project-specific conventions ("use Zod for all config schemas")
- Disambiguation ("polling" means device polling, not political polling)
- Non-obvious choices ("we use modbus-serial despite its name supporting TCP")

### 2. Minimal Disambiguation Only

Add just enough context to prevent misunderstanding, nothing more.

**Bad** (over-explaining):
```markdown
## Polling System
Polling is the process of repeatedly checking a device for new data.
In our system, we have three types of polling: dynamic, static, and on-demand.
Dynamic polling checks frequently changing values like voltage.
Static polling reads unchanging values like serial numbers.
On-demand polling only reads when explicitly requested.
```

**Good** (minimal context):
```markdown
## Polling Types
- **dynamic**: Frequent reads (measurements) - see docs/ARCHITECTURE.md "Adaptive Polling"
- **static**: Read once at startup (metadata)
- **on-demand**: Explicit requests only
```

### 3. Keep in Sync

When making changes, always check and update related documentation:

**Checklist when modifying code**:
- [ ] Does this change affect AGENTS.md guidelines?
- [ ] Is there documentation elsewhere pointing to this source of truth?
- [ ] Do code comments reference documentation that needs updating?
- [ ] Does documentation need corresponding updates?

**Checklist when updating AGENTS.md**:
- [ ] Remove outdated information
- [ ] Update references if file paths changed
- [ ] Check for redundancy with other AGENTS.md files
- [ ] Verify examples still match current code

### 4. No Examples in AGENTS.md

**Never include code examples directly in AGENTS.md files.**

Examples belong in executable code, not documentation. This ensures:
- Examples are always valid and tested
- No duplication between docs and code
- Examples stay in sync with implementation

**Instead**:
- Reference executable code files
- Link to test files demonstrating usage
- Point to example implementations

**Bad**:
```markdown
## Using the Emulator

```typescript
const emulator = new ModbusEmulator({
  transport: 'rtu',
  port: '/dev/ttyUSB0',
  devices: [{ slaveId: 1, type: 'SDM630' }]
});
await emulator.start();
```
```

**Good**:
```markdown
## Using the Emulator

See: `packages/emulator/__tests__/examples/basic-usage.test.ts`
```

**Exception**: Minimal syntax snippets for disambiguation (≤3 lines) are acceptable if they clarify usage, not demonstrate features.

## When to Update AGENTS.md

### Always Update When

1. **Adding new patterns/conventions**
   - New package added to monorepo
   - New coding standard adopted
   - New tool integrated

2. **Confusion during development**
   - Question that needed clarification
   - Mistake made due to unclear documentation
   - Ambiguous terminology causing errors
   - Non-obvious behavior discovered

3. **Architectural decisions made**
   - "Why did we choose X over Y?"
   - Non-obvious trade-offs
   - Constraints that aren't apparent from code

### Never Update For

1. **One-time issues** - Don't document every bug fix
2. **Obvious information** - If it's in standard docs, reference those
3. **Implementation details** - Those belong in code comments
4. **Temporary workarounds** - Document in code, remove when fixed

## How to Update AGENTS.md

### Step 1: Choose the Right File

```
CLAUDE.md (root)           → Project-wide conventions, setup, structure
packages/core/AGENTS.md    → Core bridge logic, polling, transport
packages/devices/AGENTS.md → Device driver patterns, register definitions
packages/cli/AGENTS.md     → CLI tool usage, command patterns
```

**Rule**: Put information at the most specific level where it's relevant.

### Step 2: Find the Right Section

Read the existing file structure. Add to existing sections if possible, create new sections only when necessary.

**Before adding a new section**, ask:
- Does this fit in an existing section?
- Is this substantial enough to warrant a section?
- Will this section have multiple items?

### Step 3: Write Concisely

**Template for new entries**:
```markdown
## [Topic]

[One sentence explaining what this is]

**Key points**:
- Point 1 (with example if needed)
- Point 2 (with reference to detailed docs)

See: [reference to full documentation]
```

**Examples**:

Good:
```markdown
## Device Discovery

Auto-detect devices on serial bus or TCP network.

**Trigger**: `npm run discover -- --port /dev/ttyUSB0`
**Output**: Device configs ready for registration

See: docs/ARCHITECTURE.md "Device Discovery & Auto-Detection"
```

Bad (too verbose):
```markdown
## Device Discovery

The device discovery system is a sophisticated multi-stage process that
automatically detects Modbus devices on both serial buses and TCP networks.
It works by iterating through different baud rates and serial configurations,
then scanning slave IDs, and finally matching response patterns against known
device signatures in our database. This eliminates the need for manual
configuration which is error-prone and time-consuming.

To use the discovery system, you need to run the CLI command with the
appropriate port parameter. For serial devices, use the device path like
/dev/ttyUSB0 on Linux or COM3 on Windows. For TCP, use the IP address and port.
[...]
```

### Step 4: Maintain Bidirectional References

When adding information that summarizes a source of truth:

1. **In AGENTS.md**: Reference the source
   ```markdown
   See: packages/core/src/types/data-types.ts for full list
   ```

2. **In source code**: Note the summary location
   ```typescript
   // Data type definitions
   // Summarized in: CLAUDE.md "Data Types", docs/ARCHITECTURE.md "Data Transformation"
   export const DATA_TYPES = { /* ... */ };
   ```

3. **Update both when either changes**

### Step 5: Review for Improvements

When touching any AGENTS.md file, take a moment to:

- **Remove outdated info**: Features removed, old conventions
- **Consolidate redundancy**: Multiple sections saying similar things
- **Update examples**: Code examples matching current syntax
- **Fix broken references**: Files moved, sections renamed
- **Improve clarity**: Confusing phrasing, ambiguous terms

## Common Patterns

### Pattern: Disambiguation

When terms could be misunderstood:

```markdown
## Terminology

- **Transport**: Modbus protocol layer (RTU/TCP), not package dependencies
- **Device**: Physical Modbus device, not device driver class
- **Register**: Modbus register address, not a list/registry
```

### Pattern: Quick Reference with Details Elsewhere

```markdown
## Test Commands

```bash
npm test                      # All tests with coverage
npm test -- --watch           # Watch mode
npm test --workspace=core     # Single package
```

See: CONTRIBUTING.md for CI/CD integration
```

### Pattern: Decision Record (Why)

```markdown
## Why modbus-serial?

Mature, well-tested, broad device compatibility.

Alternative considered: modbus-tcp (TCP-only, insufficient)
```

### Pattern: Non-Obvious Convention

```markdown
## Register Address Convention

We use **decimal** addresses in code, not hex.
Documentation often shows hex (0x0000) but code uses decimal (0).
```

## Anti-Patterns to Avoid

### ❌ Duplicating Documentation

Don't copy entire sections from docs/ARCHITECTURE.md or README.md. Reference them.

### ❌ Tutorial-Style Writing

AGENTS.md is a reference, not a tutorial. Be concise, not pedagogical.

### ❌ Exhaustive Lists

Don't list every device, every data type, every unit. Reference the source of truth.

### ❌ Explaining Common Concepts

Assume knowledge of TypeScript, Git, npm, Modbus basics, MQTT basics.

### ❌ Implementation Details

Code structure belongs in code comments and READMEs, not AGENTS.md.

### ❌ Temporary Information

Don't document current bugs, TODOs, or temporary hacks. Use code comments.

## Examples: Good vs Bad

### Example 1: Adding New Device Support

**Bad**:
```markdown
## SDM630 Energy Meter

The SDM630 is a 3-phase energy meter from Eastron. It measures voltage,
current, power, frequency, and energy. It uses Modbus RTU protocol and
supports baud rates from 2400 to 38400. The default slave ID is 1.

To add SDM630 support:
1. Create a new file in packages/devices/src/energy-meters/
2. Define the register map according to the datasheet
3. Implement the DeviceDriver interface
4. Add tests in __tests__/
5. Export from index.ts
6. Update the device registry
```

**Good**:
```markdown
## Adding Device Drivers

1. Implement `DeviceDriver` interface
2. Define data points (not raw registers)
3. Add tests using emulator
4. Register in `packages/devices/src/registry.ts`

See: packages/devices/AGENTS.md for device-specific patterns
```

### Example 2: Explaining Data Types

**Bad**:
```markdown
## Data Types

Our system supports multiple data types for representing device data:

### Float
Floating-point numbers are used for precise measurements like voltage (230.5V)
or current (5.25A). They are stored as IEEE 754 floating-point values.

### Integer
Integer values are whole numbers without decimal points. Used for counts,
states, and other discrete values.

### Boolean
True/false values represented as 1 or 0 in Modbus.

[... 10 more types with explanations ...]
```

**Good**:
```markdown
## Data Types

Standard types: float, integer, boolean, string, timestamp

Device drivers transform raw Modbus values to these types.

Full list: `packages/core/src/types/data-types.ts`
```

### Example 3: Documenting Learnings from Development

**Scenario**: During development, you discover that RTU devices need a 50ms delay between requests to prevent errors.

**Bad** (implementation detail):
```markdown
## RTU Communication Delays

When communicating with RTU devices, add a 50ms delay between requests:

```typescript
await readRegister(device, 0);
await sleep(50);
await readRegister(device, 1);
```

This prevents communication errors due to device processing time.
```

**Good** (architectural note):
```markdown
## RTU Inter-Request Delay

RTU devices require inter-request delays (device-specific, typically 50ms).

Handled automatically by transport layer - see `packages/core/src/transport/rtu.ts`
```

## Maintenance Workflow

### Regular Review (Quarterly)

- Scan for outdated information
- Check all references still valid
- Remove deprecated patterns
- Update examples to current syntax

### After Major Changes

When merging significant features:
1. Review related AGENTS.md files
2. Add new patterns/conventions discovered
3. Update references if structure changed
4. Remove obsoleted information

### During Code Review

Check if PR introduces patterns worth documenting:
- Non-obvious design decision?
- Repeated pattern across multiple files?
- Potential source of confusion?

If yes: Request AGENTS.md update in the PR.
