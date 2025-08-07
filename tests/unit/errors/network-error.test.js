const NetworkError = require('../../../src/errors/network-error');

describe('NetworkError', () => {
  it('should create error with correct properties', () => {
    const error = new NetworkError('Network connection failed', 3000, 'port check');
    
    expect(error.name).toBe('NetworkError');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toBe('Network connection failed');
    expect(error.port).toBe(3000);
    expect(error.operation).toBe('port check');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof NetworkError).toBe(true);
  });

  it('should create error without port and operation', () => {
    const error = new NetworkError('Network error');
    
    expect(error.name).toBe('NetworkError');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toBe('Network error');
    expect(error.port).toBeNull();
    expect(error.operation).toBeNull();
  });

  it('should maintain proper stack trace', () => {
    const error = new NetworkError('Test error');
    
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('NetworkError');
    expect(error.stack).toContain('Test error');
  });

  describe('getUserMessage', () => {
    it('should return formatted message with port and operation', () => {
      const error = new NetworkError('Connection timeout', 8080, 'process lookup');
      const message = error.getUserMessage();
      
      expect(message).toContain('Connection timeout (Port: 8080) (Operation: process lookup)');
      expect(message).toContain('Suggestions:');
      expect(message).toContain('Check your network connection');
      expect(message).toContain('Verify the port number is correct');
      expect(message).toContain('Ensure no firewall is blocking');
      expect(message).toContain('Try again in a few moments');
    });

    it('should return formatted message with port only', () => {
      const error = new NetworkError('Network unreachable', 443);
      const message = error.getUserMessage();
      
      expect(message).toContain('Network unreachable (Port: 443)');
      expect(message).toContain('Suggestions:');
    });

    it('should return formatted message with operation only', () => {
      const error = new NetworkError('DNS resolution failed', null, 'hostname lookup');
      const message = error.getUserMessage();
      
      expect(message).toContain('DNS resolution failed (Operation: hostname lookup)');
      expect(message).toContain('Suggestions:');
    });

    it('should return formatted message without port and operation', () => {
      const error = new NetworkError('General network error');
      const message = error.getUserMessage();
      
      expect(message).toContain('General network error');
      expect(message).toContain('Suggestions:');
      expect(message).not.toContain('Port:');
      expect(message).not.toContain('Operation:');
    });
  });

  it('should be throwable and catchable', () => {
    expect(() => {
      throw new NetworkError('Test network error', 9000, 'test operation');
    }).toThrow(NetworkError);

    try {
      throw new NetworkError('Test network error', 9000, 'test operation');
    } catch (error) {
      expect(error instanceof NetworkError).toBe(true);
      expect(error.message).toBe('Test network error');
      expect(error.port).toBe(9000);
      expect(error.operation).toBe('test operation');
    }
  });
});