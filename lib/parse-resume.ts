import { extractText, getDocumentProxy } from 'unpdf'

export type ResumeMimeType =
  | 'application/pdf'
  | 'text/markdown'
  | 'text/plain'

export class ResumeParseError extends Error {
  constructor(
    public code:
      | 'EMPTY_FILE'
      | 'UNSUPPORTED_TYPE'
      | 'PDF_EXTRACT_FAILED'
      | 'TOO_SHORT',
    message: string,
  ) {
    super(message)
    this.name = 'ResumeParseError'
  }
}

const MIN_TEXT_LEN = 100

/**
 * Parse a resume file into plain text.
 * - PDF: uses `unpdf` (modern, well-maintained replacement for pdf-parse)
 * - MD/TXT: utf-8 decode
 *
 * Throws ResumeParseError with a structured code on failure.
 */
export async function parseResume(
  data: ArrayBuffer | Uint8Array,
  mime: ResumeMimeType,
): Promise<string> {
  if (data.byteLength === 0) {
    throw new ResumeParseError('EMPTY_FILE', '空文件')
  }

  let text: string

  if (mime === 'application/pdf') {
    try {
      const pdf = await getDocumentProxy(
        data instanceof Uint8Array ? data : new Uint8Array(data),
      )
      const { text: extracted } = await extractText(pdf, { mergePages: true })
      text = Array.isArray(extracted) ? extracted.join('\n') : extracted
    } catch (err) {
      throw new ResumeParseError(
        'PDF_EXTRACT_FAILED',
        `PDF 解析失败：${(err as Error).message}`,
      )
    }
  } else if (mime === 'text/markdown' || mime === 'text/plain') {
    text = new TextDecoder('utf-8').decode(data)
  } else {
    throw new ResumeParseError('UNSUPPORTED_TYPE', `不支持的文件类型：${mime}`)
  }

  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

  if (text.length < MIN_TEXT_LEN) {
    throw new ResumeParseError(
      'TOO_SHORT',
      `提取的文本仅 ${text.length} 字，疑似解析失败或简历过短`,
    )
  }

  return text
}

export function detectMimeFromFilename(name: string): ResumeMimeType | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown'
  if (lower.endsWith('.txt')) return 'text/plain'
  return null
}
