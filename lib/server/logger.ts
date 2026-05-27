import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  redact: {
    paths: [
      'resume_text',
      'jd_text',
      '*.resume_text',
      '*.jd_text',
      'input.resume_text',
      'input.jd_text',
      'req.body.resume_text',
      'req.body.jd_text',
      'context.input.resume_text',
      'context.input.jd_text',
    ],
    censor: '[REDACTED]',
  },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss.l' },
    },
  }),
})
