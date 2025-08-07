/**
 * Custom error class for permission-related errors
 * Used when operations fail due to insufficient privileges
 */
export class PermissionError extends Error {
  public readonly name = 'PermissionError';
  public readonly code = 'PERMISSION_ERROR';
  public readonly pid: number | null;

  /**
   * Create a new PermissionError
   * @param message - Error message describing the permission issue
   * @param pid - Process ID related to the permission error (optional)
   */
  constructor(message: string, pid: number | null = null) {
    super(message);
    this.pid = pid;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PermissionError);
    }
  }
  
  /**
   * Get user-friendly error message with suggestions
   * @returns Formatted error message
   */
  getUserMessage(): string {
    let message = this.message;
    
    if (this.pid) {
      message += ` (PID: ${this.pid})`;
    }
    
    message += '\n\nSuggestion: Try running the command with elevated privileges:';
    
    if (process.platform === 'win32') {
      message += '\n- Run Command Prompt or PowerShell as Administrator';
    } else {
      message += '\n- Use sudo: sudo freeport';
    }
    
    return message;
  }
}