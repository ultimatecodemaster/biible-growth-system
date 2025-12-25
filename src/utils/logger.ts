import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createLogger, format, transports } from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

const logsDir = join(process.cwd(), 'logs')
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true })
}

// Custom format for console output (backward compatible)
const consoleFormat = format.printf(({ level, message, timestamp, ...metadata }) => {
  const ts = timestamp || new Date().toISOString()
  const meta = Object.keys(metadata).length ? JSON.stringify(metadata) : ''
  return `[${ts}] ${level.toUpperCase()}: ${message} ${meta}`
})

// JSON format for file logs (structured logging)
const fileFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
)

// Create logger instance
export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true })
  ),
  defaultMeta: { service: 'biible-ags' },
  transports: [
    // Console transport (backward compatible with existing console.log calls)
    new transports.Console({
      format: format.combine(
        format.colorize(),
        consoleFormat
      ),
      handleExceptions: true,
      handleRejections: true
    }),
    
    // Daily rotating file for all logs
    new (DailyRotateFile as any)({
      filename: join(logsDir, 'ags-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d', // Keep logs for 30 days
      format: fileFormat,
      handleExceptions: true,
      handleRejections: true
    }),
    
    // Separate error log file
    new (DailyRotateFile as any)({
      filename: join(logsDir, 'ags-error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
      handleExceptions: true,
      handleRejections: true
    })
  ],
  exitOnError: false
})

// Backward compatibility: Export logWithTime function that existing code uses
export function logWithTime(message: string): void {
  logger.info(message)
}

// Export convenience methods
export function logInfo(message: string, meta?: Record<string, unknown>): void {
  logger.info(message, meta)
}

export function logError(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
  const errorMeta = error instanceof Error 
    ? { ...meta, error: error.message, stack: error.stack }
    : { ...meta, error: String(error) }
  logger.error(message, errorMeta)
}

export function logWarn(message: string, meta?: Record<string, unknown>): void {
  logger.warn(message, meta)
}

export function logDebug(message: string, meta?: Record<string, unknown>): void {
  logger.debug(message, meta)
}

