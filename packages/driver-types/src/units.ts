/**
 * Standard units of measurement
 *
 * Canonical unit definitions for device data points.
 * Drivers should use these standard units for interoperability.
 */

/**
 * Standard unit types
 */
export type Unit =
  // Electrical
  | 'V'      // Volts
  | 'A'      // Amperes
  | 'W'      // Watts
  | 'kW'     // Kilowatts
  | 'VA'     // Volt-amperes (apparent power)
  | 'kVA'    // Kilovolt-amperes
  | 'VAr'    // Volt-amperes reactive
  | 'kVAr'   // Kilovolt-amperes reactive
  | 'Wh'     // Watt-hours
  | 'kWh'    // Kilowatt-hours
  | 'MWh'    // Megawatt-hours
  | 'Ah'     // Ampere-hours
  | 'Hz'     // Hertz (frequency)
  | 'Ω'      // Ohms (resistance)

  // Temperature
  | '°C'     // Degrees Celsius
  | '°F'     // Degrees Fahrenheit
  | 'K'      // Kelvin

  // Pressure
  | 'Pa'     // Pascals
  | 'kPa'    // Kilopascals
  | 'bar'    // Bar
  | 'psi'    // Pounds per square inch

  // Flow
  | 'L/s'    // Liters per second
  | 'L/min'  // Liters per minute
  | 'm³/h'   // Cubic meters per hour

  // Speed
  | 'm/s'    // Meters per second
  | 'km/h'   // Kilometers per hour
  | 'rpm'    // Revolutions per minute

  // Percentage
  | '%'      // Percent

  // Time
  | 's'      // Seconds
  | 'min'    // Minutes
  | 'h'      // Hours

  // Other
  | 'ppm'    // Parts per million
  | 'dB';    // Decibels
  // Note: For custom units not in this list, use the closest standard unit
  // or request addition to this type definition
