/**
 * Custom error class for network-related errors
 * Used when network operations fail or ports are unreachable
 */
export class NetworkError extends Error {
  public readonly name = 'NetworkError';
  public readonly code = 'NETWORK_ERROR';
  public readonly port: number | null;
  public readonly operation: string | null;

  /**
   * Create a new NetworkError
   * @param message - Error message describing the network issue
   * @param port - Port number related to the network error (optional)
   * @param operation - Network operation that failed (optional)
   */
  constructor(message: string, port: number | null = null, operation: string | null = null) {
    super(message);
    this.port = port;
    this.operation = operation;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NetworkError);
    }
  }
  
  /**
   * Get user-friendly error message with suggestions
   * @returns Formatted error message
   */
  getUserMessage(): string {
    let message = this.message;
    
    if (this.port) {
      message += ` (Port: ${this.port})`;
    }
    
    if (this.operation) {
      message += ` (Operation: ${this.operation})`;
    }
    
    message += '\n\nSuggestions:';
    message += '\n- Check your network connection';
    message += '\n- Verify the port number is correct and accessible';
    message += '\n- Ensure no firewall is blocking the connection';
    message += '\n- Try again in a few moments';
    
    return message;
  }
}