const { ValidationError } = require('../../../src/errors/validation-error');

describe('ValidationError', () => {
  it('should create error with correct properties', () => {
    const message = 'Test validation error';
    const error = new ValidationError(message);
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe(message);
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('should maintain proper stack trace', () => {
    const error = new ValidationError('Test error');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ValidationError');
  });

  it('should be throwable and catchable', () => {
    const message = 'Test validation error';
    
    expect(() => {
      throw new ValidationError(message);
    }).toThrow(ValidationError);
    
    expect(() => {
      throw new ValidationError(message);
    }).toThrow(message);
  });
});