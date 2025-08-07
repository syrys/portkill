const CLI = require('../../src/cli');
const PortManager = require('../../src/core/port-manager');
const inquirer = require('inquirer');
const { ValidationError, PermissionError, SystemError, NetworkError } = require('../../src/errors');

// Mock dependencies
jest.mock('../../src/core/port-manager');
jest.mock('inquirer');

describe('CLI Workflow Integration', () => {
  let cli;
  let mockPortManager;
  let consoleSpy;
  let consoleErrorSpy;
  let processExitSpy;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock PortManager
    mockPortManager = {
      checkPort: jest.fn(),
      killProcess: jest.fn()
    };
    PortManager.mockImplementation(() => mockPortManager);
    
    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock process.exit
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
    
    cli = new CLI();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Multiple Processes Edge Cases', () => {
    it('should handle multiple processes with mixed termination decisions', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'user1', protocol: 'TCP', port: 3000 },
        { pid: 5678, name: 'python', user: 'user2', protocol: 'TCP', port: 3000 },
        { pid: 9999, name: 'java', user: 'user3', protocol: 'TCP', port: 3000 }
      ];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      
      // User decides: kill first, skip second, kill third
      inquirer.prompt
        .mockResolvedValueOnce({ kill: true })   // Process 1
        .mockResolvedValueOnce({ kill: false })  // Process 2
        .mockResolvedValueOnce({ kill: true });  // Process 3
      
      mockPortManager.killProcess
        .mockResolvedValueOnce(true)   // Process 1 killed successfully
        .mockResolvedValueOnce(true);  // Process 3 killed successfully

      await cli.handlePortCommand('3000', {});

      expect(mockPortManager.checkPort).toHaveBeenCalledWith('3000');
      expect(mockPortManager.killProcess).toHaveBeenCalledWith(1234);
      expect(mockPortManager.killProcess).toHaveBeenCalledWith(9999);
      expect(mockPortManager.killProcess).not.toHaveBeenCalledWith(5678);
      
      // Verify summary output
      expect(consoleSpy).toHaveBeenCalledWith('\n📊 Summary:');
      expect(consoleSpy).toHaveBeenCalledWith('   Terminated: 2 processes');
      expect(consoleSpy).toHaveBeenCalledWith('   Skipped: 1 process');
      expect(consoleSpy).toHaveBeenCalledWith('   Port may still be in use by 1 remaining process');
    });

    it('should handle multiple processes when all are terminated', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'user1', protocol: 'TCP', port: 3000 },
        { pid: 5678, name: 'python', user: 'user2', protocol: 'TCP', port: 3000 }
      ];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      
      // User decides to kill all processes
      inquirer.prompt
        .mockResolvedValueOnce({ kill: true })
        .mockResolvedValueOnce({ kill: true });
      
      mockPortManager.killProcess
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await cli.handlePortCommand('3000', {});

      expect(mockPortManager.killProcess).toHaveBeenCalledWith(1234);
      expect(mockPortManager.killProcess).toHaveBeenCalledWith(5678);
      
      // Verify summary shows all terminated
      expect(consoleSpy).toHaveBeenCalledWith('\n📊 Summary:');
      expect(consoleSpy).toHaveBeenCalledWith('   Terminated: 2 processes');
      expect(consoleSpy).toHaveBeenCalledWith('   Skipped: 0 processes');
      expect(consoleSpy).toHaveBeenCalledWith('   Port should now be available');
    });

    it('should handle multiple processes when none are terminated', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'user1', protocol: 'TCP', port: 3000 },
        { pid: 5678, name: 'python', user: 'user2', protocol: 'TCP', port: 3000 }
      ];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      
      // User decides to skip all processes
      inquirer.prompt
        .mockResolvedValueOnce({ kill: false })
        .mockResolvedValueOnce({ kill: false });

      await cli.handlePortCommand('3000', {});

      expect(mockPortManager.killProcess).not.toHaveBeenCalled();
      
      // Verify summary shows none terminated
      expect(consoleSpy).toHaveBeenCalledWith('\n📊 Summary:');
      expect(consoleSpy).toHaveBeenCalledWith('   Terminated: 0 processes');
      expect(consoleSpy).toHaveBeenCalledWith('   Skipped: 2 processes');
      expect(consoleSpy).toHaveBeenCalledWith('   Port may still be in use by 2 remaining processes');
    });

    it('should handle multiple processes with --yes flag', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'user1', protocol: 'TCP', port: 3000 },
        { pid: 5678, name: 'python', user: 'user2', protocol: 'TCP', port: 3000 }
      ];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      mockPortManager.killProcess
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await cli.handlePortCommand('3000', { yes: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(mockPortManager.killProcess).toHaveBeenCalledWith(1234);
      expect(mockPortManager.killProcess).toHaveBeenCalledWith(5678);
      
      expect(consoleSpy).toHaveBeenCalledWith('\n📊 Summary:');
      expect(consoleSpy).toHaveBeenCalledWith('   Terminated: 2 processes');
      expect(consoleSpy).toHaveBeenCalledWith('   Port should now be available');
    });

    it('should handle mixed success/failure when killing multiple processes', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'user1', protocol: 'TCP', port: 3000 },
        { pid: 5678, name: 'python', user: 'user2', protocol: 'TCP', port: 3000 },
        { pid: 9999, name: 'java', user: 'user3', protocol: 'TCP', port: 3000 }
      ];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      
      // User decides to kill all
      inquirer.prompt
        .mockResolvedValueOnce({ kill: true })
        .mockResolvedValueOnce({ kill: true })
        .mockResolvedValueOnce({ kill: true });
      
      // First succeeds, second fails with permission error, third succeeds
      mockPortManager.killProcess
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new PermissionError('Permission denied', 5678))
        .mockResolvedValueOnce(true);

      await cli.handlePortCommand('3000', {});

      expect(mockPortManager.killProcess).toHaveBeenCalledTimes(3);
      
      // Should show individual process results
      expect(consoleSpy).toHaveBeenCalledWith('✅ Process 1234 has been successfully terminated');
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 5678');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Process 9999 has been successfully terminated');
    });
  });

  describe('No Processes Found Edge Cases', () => {
    it('should handle empty port with clear messaging', async () => {
      mockPortManager.checkPort.mockResolvedValue([]);

      await cli.handlePortCommand('3000', {});

      expect(consoleSpy).toHaveBeenCalledWith('🔍 Checking port 3000...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Port 3000 is available');
      expect(consoleSpy).toHaveBeenCalledWith('   No processes are currently using this port');
    });

    it('should handle empty port with different port numbers', async () => {
      mockPortManager.checkPort.mockResolvedValue([]);

      await cli.handlePortCommand('8080', {});

      expect(consoleSpy).toHaveBeenCalledWith('🔍 Checking port 8080...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Port 8080 is available');
      expect(consoleSpy).toHaveBeenCalledWith('   No processes are currently using this port');
    });

    it('should handle empty port when prompted for port number', async () => {
      inquirer.prompt.mockResolvedValue({ port: 9000 });
      mockPortManager.checkPort.mockResolvedValue([]);

      await cli.handlePortCommand(undefined, {});

      expect(consoleSpy).toHaveBeenCalledWith('🔍 Checking port 9000...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Port 9000 is available');
    });
  });

  describe('Comprehensive Error Handling Edge Cases', () => {
    it('should handle network errors during port check', async () => {
      const networkError = new NetworkError('Connection timeout', 3000, 'port check');
      mockPortManager.checkPort.mockRejectedValue(networkError);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Network Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Connection timeout');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Port: 3000');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Operation: port check');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle system errors during port check', async () => {
      const systemError = new SystemError('lsof command not found', 'lsof -i :3000', 127);
      mockPortManager.checkPort.mockRejectedValue(systemError);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ System Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   lsof command not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Command: lsof -i :3000');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Exit code: 127');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle validation errors for invalid port', async () => {
      const validationError = new ValidationError('Port number must be between 1 and 65535');
      mockPortManager.checkPort.mockRejectedValue(validationError);

      await cli.handlePortCommand('99999', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Validation Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Port number must be between 1 and 65535');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle permission errors during port check', async () => {
      const permissionError = new PermissionError('Access denied to system resources');
      mockPortManager.checkPort.mockRejectedValue(permissionError);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Permission Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Access denied to system resources');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle unexpected errors gracefully', async () => {
      const unexpectedError = new Error('Unexpected system failure');
      mockPortManager.checkPort.mockRejectedValue(unexpectedError);

      await cli.handlePortCommand('3000', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Unexpected Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Unexpected system failure');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Process Termination Edge Cases', () => {
    it('should handle process that fails to terminate gracefully', async () => {
      const processes = [{ pid: 1234, name: 'stubborn-process', user: 'user1', protocol: 'TCP', port: 3000 }];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      inquirer.prompt.mockResolvedValue({ kill: true });
      mockPortManager.killProcess.mockResolvedValue(false); // Process couldn't be killed

      await cli.handlePortCommand('3000', {});

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 1234');
      expect(consoleSpy).toHaveBeenCalledWith('   Process: stubborn-process');
      expect(consoleSpy).toHaveBeenCalledWith('💡 Suggestions:');
    });

    it('should handle process termination with system error', async () => {
      const processes = [{ pid: 1234, name: 'system-process', user: 'root', protocol: 'TCP', port: 3000 }];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      inquirer.prompt.mockResolvedValue({ kill: true });
      mockPortManager.killProcess.mockRejectedValue(new SystemError('Process is protected by system'));

      await cli.handlePortCommand('3000', {});

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 1234');
      expect(consoleSpy).toHaveBeenCalledWith('   Error: Process is protected by system');
      expect(consoleSpy).toHaveBeenCalledWith('💡 System Issue - Suggestions:');
    });

    it('should handle process termination with permission error', async () => {
      const processes = [{ pid: 1234, name: 'other-user-process', user: 'otheruser', protocol: 'TCP', port: 3000 }];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      inquirer.prompt.mockResolvedValue({ kill: true });
      mockPortManager.killProcess.mockRejectedValue(new PermissionError('Permission denied', 1234));

      await cli.handlePortCommand('3000', {});

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 1234');
      expect(consoleSpy).toHaveBeenCalledWith('   Error: Permission denied');
      expect(consoleSpy).toHaveBeenCalledWith('💡 Permission Issue - Suggestions:');
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle complete workflow with port prompt and multiple processes', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'user1', protocol: 'TCP', port: 8080 },
        { pid: 5678, name: 'python', user: 'user2', protocol: 'TCP', port: 8080 }
      ];
      
      // First prompt for port, then for each process
      inquirer.prompt
        .mockResolvedValueOnce({ port: 8080 })    // Port prompt
        .mockResolvedValueOnce({ kill: true })    // First process
        .mockResolvedValueOnce({ kill: false });  // Second process
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      mockPortManager.killProcess.mockResolvedValue(true);

      await cli.handlePortCommand(undefined, {});

      expect(inquirer.prompt).toHaveBeenCalledTimes(3);
      expect(mockPortManager.checkPort).toHaveBeenCalledWith(8080);
      expect(mockPortManager.killProcess).toHaveBeenCalledWith(1234);
      expect(mockPortManager.killProcess).not.toHaveBeenCalledWith(5678);
    });

    it('should handle edge case with single process that has minimal information', async () => {
      const processes = [{ 
        pid: 1234, 
        name: 'unknown', 
        user: 'unknown', 
        protocol: null, 
        port: 3000,
        command: null 
      }];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      inquirer.prompt.mockResolvedValue({ kill: true });
      mockPortManager.killProcess.mockResolvedValue(true);

      await cli.handlePortCommand('3000', {});

      expect(consoleSpy).toHaveBeenCalledWith('   PID: 1234');
      expect(consoleSpy).toHaveBeenCalledWith('   Name: unknown');
      expect(consoleSpy).toHaveBeenCalledWith('   User: unknown');
      // Should not display protocol or command if they're null/undefined
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Protocol:'));
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Command:'));
    });

    it('should handle very large number of processes on same port', async () => {
      // Create 10 processes on the same port
      const processes = Array.from({ length: 10 }, (_, i) => ({
        pid: 1000 + i,
        name: `process-${i}`,
        user: `user${i}`,
        protocol: 'TCP',
        port: 3000
      }));
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      
      // User kills every other process
      const prompts = processes.map((_, i) => ({ kill: i % 2 === 0 }));
      inquirer.prompt.mockImplementation(() => Promise.resolve(prompts.shift()));
      
      mockPortManager.killProcess.mockResolvedValue(true);

      await cli.handlePortCommand('3000', {});

      expect(consoleSpy).toHaveBeenCalledWith('📋 Found 10 processes using this port:');
      expect(mockPortManager.killProcess).toHaveBeenCalledTimes(5); // Every other process
      expect(consoleSpy).toHaveBeenCalledWith('\n📊 Summary:');
      expect(consoleSpy).toHaveBeenCalledWith('   Terminated: 5 processes');
      expect(consoleSpy).toHaveBeenCalledWith('   Skipped: 5 processes');
    });
  });
});