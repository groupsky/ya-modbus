const xymd1 = require('@ya-modbus/driver-xymd1')
const driver = xymd1.createDriver({
  transport: {
    type: 'tcp',
    host: 'localhost',
    port: 502,
    timeout: 1000,
  },
})

console.log('driver keys:', Object.keys(driver))
console.log('driver.read:', typeof driver.read)
console.log('driver:', driver)
