/**
 * Custom error class for validation errors
 * Used when user input or data validation fails
 */
export class ValidationError extends Error {
  public readonly name = 'ValidationError';
  public readonly code = 'VALIDATION_ERROR';

  /**
   * Create a new ValidationError
   * @param message - Error message describing the validation failure
   */
  constructor(message: string) {
    super(message);
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}