/**
 * Markdown parser for extracting code blocks with doctest configuration
 */

export interface DoctestConfig {
  /** Skip this code block entirely */
  skip?: boolean
  /** Only typecheck, don't run */
  typecheck?: boolean
  /** Driver package to import createDriver from */
  driver?: string
  /** Slave ID for emulator device */
  slaveId?: number
  /** Register configuration for emulator */
  registers?: {
    holding?: Record<number, number>
    input?: Record<number, number>
  }
}

export interface CodeBlock {
  /** The code content */
  code: string
  /** Language identifier (typescript, ts, etc.) */
  language: string
  /** Doctest configuration from preceding HTML comment */
  config: DoctestConfig
  /** Line number in source file where code block starts */
  lineNumber: number
  /** Source file path */
  filePath: string
}

/**
 * Parse doctest configuration from HTML comment
 */
function parseConfig(comment: string): DoctestConfig {
  const trimmed = comment.trim()

  // Handle simple skip
  if (trimmed === 'skip') {
    return { skip: true }
  }

  // Handle JSON config
  try {
    return JSON.parse(trimmed) as DoctestConfig
  } catch {
    // If not valid JSON, treat as skip
    return { skip: true }
  }
}

/**
 * Extract code blocks from markdown content
 */
export function parseMarkdown(content: string, filePath: string): CodeBlock[] {
  const blocks: CodeBlock[] = []

  // Regex to match code blocks with language
  // Captures: language, code content
  const codeBlockRegex = /```(typescript|ts)\n([\s\S]*?)```/g

  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1] ?? 'typescript'
    const code = match[2] ?? ''
    const matchIndex = match.index

    // Calculate line number
    const textBefore = content.slice(0, matchIndex)
    const lineNumber = textBefore.split('\n').length

    // Look for doctest comment in the 500 chars before this code block
    // We need to find the LAST comment (closest to the code block)
    const searchStart = Math.max(0, matchIndex - 500)
    const textToSearch = content.slice(searchStart, matchIndex)

    let config: DoctestConfig = {}

    // Find all doctest comments and use the last valid one
    const globalCommentRegex = /<!--\s*doctest:\s*([\s\S]*?)\s*-->/g
    let commentMatch
    let lastValidConfig: DoctestConfig | null = null

    while ((commentMatch = globalCommentRegex.exec(textToSearch)) !== null) {
      const commentEnd = (commentMatch.index ?? 0) + commentMatch[0].length
      const textAfterComment = textToSearch.slice(commentEnd)

      // Only use this comment if there's no code block between it and our target
      if (!textAfterComment.includes('```')) {
        lastValidConfig = parseConfig(commentMatch[1] ?? '')
      }
    }

    if (lastValidConfig !== null) {
      config = lastValidConfig
    }

    blocks.push({
      code: code.trim(),
      language,
      config,
      lineNumber,
      filePath,
    })
  }

  return blocks
}

/**
 * Filter code blocks to only those that should be tested
 *
 * Only blocks with explicit doctest config are tested.
 * Blocks without config are skipped by default.
 */
export function getTestableBlocks(blocks: CodeBlock[]): CodeBlock[] {
  return blocks.filter((block) => {
    // Skip if explicitly marked
    if (block.config.skip === true) {
      return false
    }

    // Only test blocks that have explicit doctest configuration
    // Empty config {} means no doctest comment was found
    const hasConfig = Object.keys(block.config).length > 0
    if (!hasConfig) {
      return false
    }

    // Include blocks with explicit doctest config
    return true
  })
}
