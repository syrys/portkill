const SystemError = require('../../../src/errors/system-error');

describe('SystemError', () => {
  it('should create error with correct properties', () => {
    const error = new SystemError('System failure', 'lsof -i :3000', 127);
    
    expect(error.name).toBe('SystemError');
    expect(error.code).toBe('SYSTEM_ERROR');
    expect(error.message).toBe('System failure');
    expect(error.command).toBe('lsof -i :3000');
    expect(error.exitCode).toBe(127);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SystemError);
  });

  it('should create error without command and exit code', () => {
    const error = new SystemError('System failure');
    
    expect(error.name).toBe('SystemError');
    expect(error.code).toBe('SYSTEM_ERROR');
    expect(error.message).toBe('System failure');
    expect(error.command).toBe(null);
    expect(error.exitCode).toBe(null);
  });

  it('should maintain proper stack trace', () => {
    const error = new SystemError('System failure');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('SystemError');
  });

  it('should be throwable and catchable', () => {
    expect(() => {
      throw new SystemError('Test error');
    }).toThrow(SystemError);
    
    try {
      throw new SystemError('Test error');
    } catch (error) {
      expect(error).toBeInstanceOf(SystemError);
      expect(error.message).toBe('Test error');
    }
  });

  describe('getUserMessage', () => {
    it('should return formatted message with command and exit code', () => {
      const error = new SystemError('Command failed', 'netstat -ano', 1);
      const message = error.getUserMessage();
      
      expect(message).toBe('Command failed\nCommand: netstat -ano\nExit code: 1');
    });

    it('should return formatted message with command only', () => {
      const error = new SystemError('Command failed', 'lsof -i :3000');
      const message = error.getUserMessage();
      
      expect(message).toBe('Command failed\nCommand: lsof -i :3000');
    });

    it('should return formatted message with exit code only', () => {
      const error = new SystemError('Command failed', null, 127);
      const message = error.getUserMessage();
      
      expect(message).toBe('Command failed\nExit code: 127');
    });

    it('should return formatted message without command and exit code', () => {
      const error = new SystemError('System failure');
      const message = error.getUserMessage();
      
      expect(message).toBe('System failure');
    });
  });
});