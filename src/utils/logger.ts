/**
 * Simple logging utility for debugging purposes
 * Provides different log levels and can be controlled via environment variables
 */

/**
 * Log levels in order of severity
 */
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

/**
 * Logger class for debugging and information output
 */
export class Logger {
  private readonly name: string;
  private readonly level: number;

  /**
   * Create a new Logger instance
   * @param name - Logger name (usually module or class name)
   */
  constructor(name = 'PortKill') {
    this.name = name;
    this.level = this._getLogLevel();
  }

  /**
   * Get the current log level from environment variables
   * @returns Log level number
   * @private
   */
  private _getLogLevel(): number {
    const envLevel = process.env.PORTKILL_LOG_LEVEL ?? process.env.LOG_LEVEL ?? 'INFO';
    const level = LOG_LEVELS[envLevel.toUpperCase() as LogLevel];
    return level !== undefined ? level : LOG_LEVELS.INFO;
  }

  /**
   * Check if a log level should be output
   * @param level - Log level to check
   * @returns True if should log
   * @private
   */
  private _shouldLog(level: number): boolean {
    return level <= this.level;
  }

  /**
   * Format log message with timestamp and level
   * @param level - Log level name
   * @param message - Log message
   * @param args - Additional arguments
   * @returns Formatted message
   * @private
   */
  private _formatMessage(level: string, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    
    return `[${timestamp}] ${level} [${this.name}] ${message}${formattedArgs}`;
  }

  /**
   * Log error message
   * @param message - Error message
   * @param args - Additional arguments
   */
  error(message: string, ...args: unknown[]): void {
    if (this._shouldLog(LOG_LEVELS.ERROR)) {
      console.error(this._formatMessage('ERROR', message, ...args));
    }
  }

  /**
   * Log warning message
   * @param message - Warning message
   * @param args - Additional arguments
   */
  warn(message: string, ...args: unknown[]): void {
    if (this._shouldLog(LOG_LEVELS.WARN)) {
      console.warn(this._formatMessage('WARN', message, ...args));
    }
  }

  /**
   * Log info message
   * @param message - Info message
   * @param args - Additional arguments
   */
  info(message: string, ...args: unknown[]): void {
    if (this._shouldLog(LOG_LEVELS.INFO)) {
      console.log(this._formatMessage('INFO', message, ...args));
    }
  }

  /**
   * Log debug message
   * @param message - Debug message
   * @param args - Additional arguments
   */
  debug(message: string, ...args: unknown[]): void {
    if (this._shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(this._formatMessage('DEBUG', message, ...args));
    }
  }

  /**
   * Log trace message
   * @param message - Trace message
   * @param args - Additional arguments
   */
  trace(message: string, ...args: unknown[]): void {
    if (this._shouldLog(LOG_LEVELS.TRACE)) {
      console.log(this._formatMessage('TRACE', message, ...args));
    }
  }

  /**
   * Create a child logger with a specific name
   * @param name - Child logger name
   * @returns New logger instance
   */
  child(name: string): Logger {
    return new Logger(`${this.name}:${name}`);
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a logger with a specific name
 * @param name - Logger name
 * @returns Logger instance
 */
export function createLogger(name: string): Logger {
  return new Logger(name);
}