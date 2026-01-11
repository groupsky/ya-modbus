const driver = require('@ya-modbus/driver-xymd1')
const sdk = require('@ya-modbus/driver-sdk')
const transport = require('@ya-modbus/transport')

console.log('driver-xymd1 keys:', Object.keys(driver))
console.log('driver-sdk keys:', Object.keys(sdk).slice(0, 3), '...')
console.log('transport keys:', Object.keys(transport).slice(0, 3), '...')
console.log('metadata:', driver.metadata)
console.log('Has dataPoints:', driver.dataPoints !== undefined)
