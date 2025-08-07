/**
 * Custom error class for system-related errors
 * Used when system commands fail or system resources are unavailable
 */
export class SystemError extends Error {
  public readonly name = 'SystemError';
  public readonly code = 'SYSTEM_ERROR';
  public readonly command: string | null;
  public readonly exitCode: number | null;

  /**
   * Create a new SystemError
   * @param message - Error message describing the system issue
   * @param command - System command that failed (optional)
   * @param exitCode - Exit code of the failed command (optional)
   */
  constructor(message: string, command: string | null = null, exitCode: number | null = null) {
    super(message);
    this.command = command;
    this.exitCode = exitCode;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SystemError);
    }
  }
  
  /**
   * Get user-friendly error message with context
   * @returns Formatted error message
   */
  getUserMessage(): string {
    let message = this.message;
    
    if (this.command) {
      message += `\nCommand: ${this.command}`;
    }
    
    if (this.exitCode !== null) {
      message += `\nExit code: ${this.exitCode}`;
    }
    
    return message;
  }
}