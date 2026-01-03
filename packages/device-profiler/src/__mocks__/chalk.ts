// Mock chalk for Jest tests
const mockChalk = {
  bold: (str: string): string => str,
  cyan: (str: string): string => str,
  green: (str: string): string => str,
  red: (str: string): string => str,
  yellow: (str: string): string => str,
  gray: (str: string): string => str,
}

export default mockChalk
