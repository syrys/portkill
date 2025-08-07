const PermissionError = require('../../../src/errors/permission-error');

describe('PermissionError', () => {
  it('should create error with correct properties', () => {
    const message = 'Permission denied';
    const pid = 1234;
    const error = new PermissionError(message, pid);
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PermissionError);
    expect(error.message).toBe(message);
    expect(error.name).toBe('PermissionError');
    expect(error.code).toBe('PERMISSION_ERROR');
    expect(error.pid).toBe(pid);
  });

  it('should create error without PID', () => {
    const message = 'Permission denied';
    const error = new PermissionError(message);
    
    expect(error.message).toBe(message);
    expect(error.pid).toBe(null);
  });

  describe('getUserMessage', () => {
    it('should return formatted message with PID on Unix systems', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      
      const error = new PermissionError('Access denied', 1234);
      const userMessage = error.getUserMessage();
      
      expect(userMessage).toContain('Access denied (PID: 1234)');
      expect(userMessage).toContain('sudo freeport');
      expect(userMessage).not.toContain('Administrator');
      
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return formatted message with PID on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      const error = new PermissionError('Access denied', 1234);
      const userMessage = error.getUserMessage();
      
      expect(userMessage).toContain('Access denied (PID: 1234)');
      expect(userMessage).toContain('Administrator');
      expect(userMessage).not.toContain('sudo');
      
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return formatted message without PID', () => {
      const error = new PermissionError('Access denied');
      const userMessage = error.getUserMessage();
      
      expect(userMessage).toContain('Access denied');
      expect(userMessage).not.toContain('PID:');
      expect(userMessage).toContain('elevated privileges');
    });
  });

  it('should maintain proper stack trace', () => {
    const error = new PermissionError('Test error');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('PermissionError');
  });
});