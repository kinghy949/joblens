import { describe, it, expect } from 'vitest'
import {
  parseResume,
  detectMimeFromFilename,
  ResumeParseError,
} from '../parse-resume'

describe('detectMimeFromFilename', () => {
  it('detects PDF', () => {
    expect(detectMimeFromFilename('resume.pdf')).toBe('application/pdf')
    expect(detectMimeFromFilename('Resume.PDF')).toBe('application/pdf')
  })
  it('detects Markdown', () => {
    expect(detectMimeFromFilename('resume.md')).toBe('text/markdown')
    expect(detectMimeFromFilename('resume.markdown')).toBe('text/markdown')
  })
  it('detects plain text', () => {
    expect(detectMimeFromFilename('resume.txt')).toBe('text/plain')
  })
  it('returns null for unsupported', () => {
    expect(detectMimeFromFilename('resume.docx')).toBeNull()
  })
})

describe('parseResume', () => {
  it('rejects empty buffer', async () => {
    await expect(parseResume(new Uint8Array(0), 'text/plain')).rejects.toThrow(
      ResumeParseError,
    )
  })

  it('decodes plain text correctly', async () => {
    const text = '我是一个合格的简历内容，包含足够的字符让解析不被视为过短失败。'.repeat(5)
    const bytes = new TextEncoder().encode(text)
    const out = await parseResume(bytes, 'text/plain')
    expect(out.length).toBeGreaterThan(100)
  })

  it('decodes markdown correctly', async () => {
    const md = `# 张三\n\n## 工作经历\n\n` + '负责后端开发。\n'.repeat(20)
    const bytes = new TextEncoder().encode(md)
    const out = await parseResume(bytes, 'text/markdown')
    expect(out).toContain('张三')
  })

  it('throws TOO_SHORT for tiny content', async () => {
    await expect(
      parseResume(new TextEncoder().encode('短'), 'text/plain'),
    ).rejects.toThrow(/TOO_SHORT|过短/)
  })

  it('throws UNSUPPORTED_TYPE for unknown mime', async () => {
    const bytes = new TextEncoder().encode('x'.repeat(200))
    await expect(
      parseResume(bytes, 'application/octet-stream' as never),
    ).rejects.toThrow(ResumeParseError)
  })

  it('normalizes CRLF and excessive newlines', async () => {
    const text = '段落 1\r\n\r\n\r\n\r\n段落 2\r\n\r\n段落 3'.repeat(10)
    const bytes = new TextEncoder().encode(text)
    const out = await parseResume(bytes, 'text/plain')
    expect(out).not.toContain('\r')
    expect(out).not.toMatch(/\n{3,}/)
  })
})
