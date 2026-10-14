import { getSerialNodeWarning } from './serial-node-warning.js'

test.each(['v22.0.0', 'v22.20.0', 'v24.11.1', 'v26.3.1'])(
  'gives no warning on Node.js %s, where serial requests work',
  (nodeVersion) => {
    expect(getSerialNodeWarning(nodeVersion)).toBeUndefined()
  }
)

// Since Node.js 26.4.0 the serialport poller callback does not run pending promise work,
// so the response waits and the request times out (issue #507)
test.each(['v26.4.0', 'v26.8.2', 'v27.0.0', '26.4.0', 'v26.4.0-nightly20260601a1b2c3d4e5'])(
  'warns that serial requests time out on Node.js %s',
  (nodeVersion) => {
    expect(getSerialNodeWarning(nodeVersion)).toBe(
      `Warning: on Node.js 26.4 and newer, serial (RTU) requests time out (this is Node.js ${nodeVersion}). ` +
        'Use Node.js 22 or 24. See https://github.com/groupsky/ya-modbus/issues/507'
    )
  }
)
