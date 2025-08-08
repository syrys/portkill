// Mock dependencies first
jest.mock('../../src/core/port-manager', () => ({
  PortManager: jest.fn()
}));

// Import after mocking
const { CLI } = require('../../src/cli');
const { ValidationError, PermissionError, SystemError, NetworkError } = require('../../src/errors');
const { PortManager } = require('../../src/core/port-manager');

describe('Error Scenarios Integration Tests', () => {
  let cli;
  let mockPortManager;
  let consoleSpy;
  let consoleErrorSpy;
  let processExitSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock PortManager
    mockPortManager = {
      checkPort: jest.fn(),
      killProcess: jest.fn(),
      initialize: jest.fn()
    };
    PortManager.mockImplementation(() => mockPortManager);
    
    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
    
    cli = new CLI();
  });

  afterEach(() => {
    if (consoleSpy) consoleSpy.mockRestore();
    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
    if (processExitSpy) processExitSpy.mockRestore();
  });

  describe('Validation Error Scenarios', () => {
    it('should handle invalid port number validation error', async () => {
      const validationError = new ValidationError('Port number must be between 1 and 65535');
      mockPortManager.checkPort.mockRejectedValue(validationError);

      await cli.handlePortCommand('99999', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Validation Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Port number must be between 1 and 65535');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle negative port number validation error', async () => {
      const validationError = new ValidationError('Port number must be a positive integer');
      mockPortManager.checkPort.mockRejectedValue(validationError);

      await cli.handlePortCommand('-1', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Validation Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Port number must be a positive integer');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle non-numeric port validation error', async () => {
      const validationError = new ValidationError('Port must be a valid number');
      mockPortManager.checkPort.mockRejectedValue(validationError);

      await cli.handlePortCommand('abc', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Validation Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Port must be a valid number');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle PID validation error during kill process', async () => {
      const processes = [{ pid: 1234, name: 'node', user: 'testuser', protocol: 'TCP', port: 3000 }];
      mockPortManager.checkPort.mockResolvedValue(processes);
      
      const validationError = new ValidationError('Invalid process ID');
      mockPortManager.killProcess.mockRejectedValue(validationError);

      await cli.handlePortCommand('3000', { yes: true });

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 1234');
      expect(consoleSpy).toHaveBeenCalledWith('   Error: Invalid process ID');
    });
  });

  describe('Permission Error Scenarios', () => {
    it('should handle permission denied during port check', async () => {
      const permissionError = new PermissionError('Access denied to system resources');
      mockPortManager.checkPort.mockRejectedValue(permissionError);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Permission Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Access denied to system resources');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle permission denied during process termination', async () => {
      const processes = [{ pid: 1234, name: 'system-process', user: 'root', protocol: 'TCP', port: 3000 }];
      mockPortManager.checkPort.mockResolvedValue(processes);
      
      const permissionError = new PermissionError('Permission denied', 1234);
      mockPortManager.killProcess.mockRejectedValue(permissionError);

      await cli.handlePortCommand('3000', { yes: true });

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 1234');
      expect(consoleSpy).toHaveBeenCalledWith('   Error: Permission denied');
      expect(consoleSpy).toHaveBeenCalledWith('💡 Permission Issue - Suggestions:');
    });

    it('should handle permission error with specific PID context', async () => {
      const processes = [{ pid: 5678, name: 'protected-service', user: 'system', protocol: 'TCP', port: 80 }];
      mockPortManager.checkPort.mockResolvedValue(processes);
      
      const permissionError = new PermissionError('Operation not permitted', 5678);
      mockPortManager.killProcess.mockRejectedValue(permissionError);

      await cli.handlePortCommand('80', { yes: true });

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 5678');
      expect(consoleSpy).toHaveBeenCalledWith('   Error: Operation not permitted');
      expect(consoleSpy).toHaveBeenCalledWith('   PID: 5678');
    });
  });

  describe('System Error Scenarios', () => {
    it('should handle system command not found error', async () => {
      const systemError = new SystemError('lsof command not found', 'lsof -i :3000', 127);
      mockPortManager.checkPort.mockRejectedValue(systemError);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ System Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   lsof command not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Command: lsof -i :3000');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Exit code: 127');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle system error without command details', async () => {
      const systemError = new SystemError('System resources unavailable');
      mockPortManager.checkPort.mockRejectedValue(systemError);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ System Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   System resources unavailable');
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Command:'));
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Exit code:'));
    });

    it('should handle system error during process termination', async () => {
      const processes = [{ pid: 1234, name: 'stubborn-process', user: 'testuser', protocol: 'TCP', port: 3000 }];
      mockPortManager.checkPort.mockResolvedValue(processes);
      
      const systemError = new SystemError('Process is protected by system', 'kill -TERM 1234', 1);
      mockPortManager.killProcess.mockRejectedValue(systemError);

      await cli.handlePortCommand('3000', { yes: true });

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 1234');
      expect(consoleSpy).toHaveBeenCalledWith('   Error: Process is protected by system');
      expect(consoleSpy).toHaveBeenCalledWith('💡 System Issue - Suggestions:');
    });

    it('should handle platform compatibility system error', async () => {
      const systemError = new SystemError('Unsupported platform: freebsd');
      mockPortManager.checkPort.mockRejectedValue(systemError);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ System Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Unsupported platform: freebsd');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Network Error Scenarios', () => {
    it('should handle network error with full context', async () => {
      const networkError = new NetworkError('Connection timeout', 3000, 'port check');
      mockPortManager.checkPort.mockRejectedValue(networkError);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Network Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Connection timeout');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Port: 3000');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Operation: port check');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle network error with partial context', async () => {
      const networkError = new NetworkError('Network unreachable', 8080);
      mockPortManager.checkPort.mockRejectedValue(networkError);

      await cli.handlePortCommand('8080', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Network Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Network unreachable');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Port: 8080');
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Operation:'));
    });

    it('should handle network error without context', async () => {
      const networkError = new NetworkError('DNS resolution failed');
      mockPortManager.checkPort.mockRejectedValue(networkError);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Network Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   DNS resolution failed');
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Port:'));
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Operation:'));
    });
  });

  describe('Unexpected Error Scenarios', () => {
    it('should handle generic JavaScript error', async () => {
      const genericError = new Error('Unexpected system failure');
      mockPortManager.checkPort.mockRejectedValue(genericError);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Unexpected Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Unexpected system failure');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle null/undefined error', async () => {
      mockPortManager.checkPort.mockRejectedValue(null);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Unexpected Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Unknown error occurred');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle error without message', async () => {
      const errorWithoutMessage = new Error();
      mockPortManager.checkPort.mockRejectedValue(errorWithoutMessage);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Unexpected Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   ');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle TypeError during process termination', async () => {
      const processes = [{ pid: 1234, name: 'node', user: 'testuser', protocol: 'TCP', port: 3000 }];
      mockPortManager.checkPort.mockResolvedValue(processes);
      
      const typeError = new TypeError('Cannot read property of undefined');
      mockPortManager.killProcess.mockRejectedValue(typeError);

      await cli.handlePortCommand('3000', { yes: true });

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 1234');
      expect(consoleSpy).toHaveBeenCalledWith('   Error: Cannot read property of undefined');
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should continue processing remaining processes after one fails', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'user1', protocol: 'TCP', port: 3000 },
        { pid: 5678, name: 'python', user: 'user2', protocol: 'TCP', port: 3000 },
        { pid: 9999, name: 'java', user: 'user3', protocol: 'TCP', port: 3000 }
      ];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      mockPortManager.killProcess
        .mockResolvedValueOnce(true)  // First succeeds
        .mockRejectedValueOnce(new PermissionError('Permission denied', 5678))  // Second fails
        .mockResolvedValueOnce(true); // Third succeeds

      await cli.handlePortCommand('3000', { yes: true });

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Auto-killing all processes (--yes flag used)...');
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 5678: Permission denied');
    });

    it('should handle mixed error types during multiple process termination', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'user1', protocol: 'TCP', port: 3000 },
        { pid: 5678, name: 'system', user: 'root', protocol: 'TCP', port: 3000 },
        { pid: 9999, name: 'app', user: 'user3', protocol: 'TCP', port: 3000 }
      ];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      mockPortManager.killProcess
        .mockResolvedValueOnce(true)  // First succeeds
        .mockRejectedValueOnce(new SystemError('Process protected by system'))  // Second fails with system error
        .mockRejectedValueOnce(new PermissionError('Access denied', 9999)); // Third fails with permission error

      await cli.handlePortCommand('3000', { yes: true });

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Auto-killing all processes (--yes flag used)...');
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 5678: Process protected by system');
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 9999: Access denied');
    });

    it('should provide appropriate suggestions for different error types', async () => {
      const processes = [{ pid: 1234, name: 'system-service', user: 'root', protocol: 'TCP', port: 80 }];
      mockPortManager.checkPort.mockResolvedValue(processes);
      
      const permissionError = new PermissionError('Operation not permitted', 1234);
      mockPortManager.killProcess.mockRejectedValue(permissionError);

      await cli.handlePortCommand('80', { yes: true });

      expect(consoleSpy).toHaveBeenCalledWith('💡 Permission Issue - Suggestions:');
    });
  });
});