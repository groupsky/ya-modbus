/**
 * Extract expected outputs from code comments
 *
 * Finds patterns like:
 *   console.log(values)
 *   // { temperature: 24.5, humidity: 65.2 }
 *
 * And extracts the expected output for assertion.
 */

export interface ExpectedOutput {
  /** Line number of the console.log statement */
  lineNumber: number
  /** The expected output string */
  expected: string
  /** Type of match: 'exact' | 'json' | 'regex' */
  matchType: 'exact' | 'json' | 'regex'
}

/**
 * Extract expected outputs from code
 */
export function extractExpectedOutputs(code: string): ExpectedOutput[] {
  const outputs: ExpectedOutput[] = []
  const lines = code.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue

    // Check if this line has a console.log
    if (!line.includes('console.log')) {
      continue
    }

    // Look at the next line(s) for expected output comment
    let j = i + 1
    while (j < lines.length) {
      const nextLine = lines[j]
      if (nextLine === undefined) break

      const trimmed = nextLine.trim()

      // Skip empty lines
      if (trimmed === '') {
        j++
        continue
      }

      // Check if it's a comment with expected output
      if (trimmed.startsWith('//')) {
        const expectedRaw = trimmed.slice(2).trim()

        if (expectedRaw.length > 0) {
          const output = parseExpectedOutput(expectedRaw, i + 1)
          outputs.push(output)
        }
        break
      }

      // If we hit a non-comment, non-empty line, stop looking
      break
    }
  }

  return outputs
}

/**
 * Parse expected output and determine match type
 */
function parseExpectedOutput(raw: string, lineNumber: number): ExpectedOutput {
  // Check if it's a regex pattern (starts and ends with /)
  if (raw.startsWith('/') && raw.lastIndexOf('/') > 0) {
    return {
      lineNumber,
      expected: raw,
      matchType: 'regex',
    }
  }

  // Check if it looks like JSON (starts with { or [)
  if (raw.startsWith('{') || raw.startsWith('[')) {
    return {
      lineNumber,
      expected: raw,
      matchType: 'json',
    }
  }

  // Default to exact match
  return {
    lineNumber,
    expected: raw,
    matchType: 'exact',
  }
}

/**
 * Compare actual output with expected
 */
export function assertOutput(
  actual: string,
  expected: ExpectedOutput
): { pass: boolean; message: string } {
  switch (expected.matchType) {
    case 'regex': {
      // Extract regex pattern (remove surrounding slashes)
      const lastSlash = expected.expected.lastIndexOf('/')
      const pattern = expected.expected.slice(1, lastSlash)
      const flags = expected.expected.slice(lastSlash + 1)

      try {
        const regex = new RegExp(pattern, flags)
        const pass = regex.test(actual)
        return {
          pass,
          message: pass
            ? `Output matches regex ${expected.expected}`
            : `Output "${actual}" does not match regex ${expected.expected}`,
        }
      } catch {
        return {
          pass: false,
          message: `Invalid regex pattern: ${expected.expected}`,
        }
      }
    }

    case 'json': {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const actualParsed = JSON.parse(actual)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedParsed = JSON.parse(expected.expected)
        const pass = JSON.stringify(actualParsed) === JSON.stringify(expectedParsed)
        return {
          pass,
          message: pass
            ? `JSON output matches expected`
            : `JSON mismatch:\n  Expected: ${expected.expected}\n  Actual: ${actual}`,
        }
      } catch {
        // If actual isn't valid JSON, do string comparison
        const pass = actual.trim() === expected.expected.trim()
        return {
          pass,
          message: pass
            ? `Output matches expected`
            : `Output mismatch:\n  Expected: ${expected.expected}\n  Actual: ${actual}`,
        }
      }
    }

    case 'exact':
    default: {
      const pass = actual.trim() === expected.expected.trim()
      return {
        pass,
        message: pass
          ? `Output matches expected`
          : `Output mismatch:\n  Expected: ${expected.expected}\n  Actual: ${actual}`,
      }
    }
  }
}
