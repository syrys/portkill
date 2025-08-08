// Mock dependencies first
jest.mock('../../src/core/port-manager', () => ({
  PortManager: jest.fn()
}));

const mockPrompt = jest.fn();
jest.mock('inquirer', () => ({
  prompt: mockPrompt,
  Separator: jest.fn()
}));

// Import after mocking
const { CLI } = require('../../src/cli');
const inquirer = require('inquirer');
const { ValidationError, PermissionError, SystemError, NetworkError } = require('../../src/errors');
const { PortManager } = require('../../src/core/port-manager');

describe('CLI', () => {
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
      killProcess: jest.fn(),
      initialize: jest.fn()
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
    if (consoleSpy) consoleSpy.mockRestore();
    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
    if (processExitSpy) processExitSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize CLI with proper configuration', () => {
      // Create a new CLI instance to test the constructor
      const testCli = new CLI();
      expect(testCli.program).toBeDefined();
      expect(testCli.portManager).toBeDefined();
      expect(PortManager).toHaveBeenCalled();
    });
  });

  describe('promptForPort', () => {
    it('should prompt for port number and validate input', async () => {
      mockPrompt.mockResolvedValue({ port: 3000 });
      
      const result = await cli.promptForPort();
      
      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'port',
          message: 'Enter port number:',
          validate: expect.any(Function),
          filter: expect.any(Function)
        })
      ]);
      expect(result).toBe(3000);
    });

    it('should validate port number range', async () => {
      const questions = mockPrompt.mock.calls[0]?.[0] || [];
      const validateFn = questions[0]?.validate;
      
      if (validateFn) {
        expect(validateFn('3000')).toBe(true);
        expect(validateFn('0')).toBe('Please enter a valid port number (1-65535)');
        expect(validateFn('65536')).toBe('Please enter a valid port number (1-65535)');
        expect(validateFn('abc')).toBe('Please enter a valid port number (1-65535)');
      }
    });

    it('should filter input to integer', async () => {
      const questions = mockPrompt.mock.calls[0]?.[0] || [];
      const filterFn = questions[0]?.filter;
      
      if (filterFn) {
        expect(filterFn('3000')).toBe(3000);
        expect(filterFn('8080')).toBe(8080);
      }
    });
  });

  describe('displayProcesses', () => {
    it('should display single process information', () => {
      const processes = [{
        pid: 1234,
        name: 'node',
        user: 'testuser',
        protocol: 'TCP',
        command: 'node server.js'
      }];

      cli.displayProcesses(processes);

      expect(consoleSpy).toHaveBeenCalledWith('📋 Found 1 process using this port:');
      expect(consoleSpy).toHaveBeenCalledWith('🔸 Process Details:');
      expect(consoleSpy).toHaveBeenCalledWith('   PID: 1234');
      expect(consoleSpy).toHaveBeenCalledWith('   Name: node');
      expect(consoleSpy).toHaveBeenCalledWith('   User: testuser');
      expect(consoleSpy).toHaveBeenCalledWith('   Protocol: TCP');
      expect(consoleSpy).toHaveBeenCalledWith('   Command: node server.js');
    });

    it('should display multiple processes information', () => {
      const processes = [
        {
          pid: 1234,
          name: 'node',
          user: 'testuser',
          protocol: 'TCP'
        },
        {
          pid: 5678,
          name: 'python',
          user: 'testuser',
          protocol: 'TCP'
        }
      ];

      cli.displayProcesses(processes);

      expect(consoleSpy).toHaveBeenCalledWith('📋 Found 2 processes using this port:');
      expect(consoleSpy).toHaveBeenCalledWith('🔸 Process 1:');
      expect(consoleSpy).toHaveBeenCalledWith('🔸 Process 2:');
    });

    it('should not display command if same as name', () => {
      const processes = [{
        pid: 1234,
        name: 'node',
        user: 'testuser',
        command: 'node'
      }];

      cli.displayProcesses(processes);

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Command:'));
    });
  });

  describe('promptForKill', () => {
    it('should prompt for single process termination', async () => {
      const process = { pid: 1234, name: 'node' };
      mockPrompt.mockResolvedValue({ kill: true });

      const result = await cli.promptForKill(process);

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'kill',
          message: 'Do you want to kill this process (PID: 1234)?',
          default: false
        })
      ]);
      expect(result).toBe(true);
    });

    it('should prompt for multiple process termination with process number', async () => {
      const process = { pid: 1234, name: 'node' };
      mockPrompt.mockResolvedValue({ kill: false });

      const result = await cli.promptForKill(process, 2);

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          message: 'Do you want to kill process 2 (PID: 1234)?'
        })
      ]);
      expect(result).toBe(false);
    });
  });

  describe('killProcess', () => {
    it('should successfully kill process', async () => {
      const process = { pid: 1234, name: 'node' };
      mockPortManager.killProcess.mockResolvedValue(true);

      await cli.killProcess(process);

      expect(mockPortManager.killProcess).toHaveBeenCalledWith(1234);
      expect(consoleSpy).toHaveBeenCalledWith('\n🔄 Attempting to terminate process 1234 (node)...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Process 1234 has been successfully terminated');
    });

    it('should handle failed process termination', async () => {
      const process = { pid: 1234, name: 'node' };
      mockPortManager.killProcess.mockResolvedValue(false);

      await cli.killProcess(process);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 1234');
    });

    it('should handle permission errors', async () => {
      const process = { pid: 1234, name: 'node' };
      mockPortManager.killProcess.mockRejectedValue(new PermissionError('Permission denied'));

      await cli.killProcess(process);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 1234');
      expect(consoleSpy).toHaveBeenCalledWith('   Error: Permission denied');
    });

    it('should handle other errors', async () => {
      const process = { pid: 1234, name: 'node' };
      mockPortManager.killProcess.mockRejectedValue(new Error('System error'));

      await cli.killProcess(process);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 1234');
      expect(consoleSpy).toHaveBeenCalledWith('   Error: System error');
    });
  });

  describe('handlePortCommand', () => {
    it('should handle port command with no processes found', async () => {
      mockPortManager.checkPort.mockResolvedValue([]);

      await cli.handlePortCommand('3000', {});

      expect(mockPortManager.checkPort).toHaveBeenCalledWith('3000');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Port 3000 is available');
    });

    it('should handle port command with single process', async () => {
      const processes = [{ pid: 1234, name: 'node', user: 'testuser' }];
      mockPortManager.checkPort.mockResolvedValue(processes);
      mockPrompt.mockResolvedValue({ kill: false });

      await cli.handlePortCommand('3000', {});

      expect(mockPortManager.checkPort).toHaveBeenCalledWith('3000');
      expect(consoleSpy).toHaveBeenCalledWith('ℹ️  Process not terminated - port remains in use');
    });

    it('should handle port command with --yes flag', async () => {
      const processes = [{ pid: 1234, name: 'node', user: 'testuser' }];
      mockPortManager.checkPort.mockResolvedValue(processes);
      mockPortManager.killProcess.mockResolvedValue(true);

      await cli.handlePortCommand('3000', { yes: true });

      expect(mockPortManager.killProcess).toHaveBeenCalledWith(1234);
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should handle port command with verbose flag', async () => {
      mockPortManager.checkPort.mockResolvedValue([]);

      await cli.handlePortCommand('3000', { verbose: true });

      expect(consoleSpy).toHaveBeenCalledWith('🔍 Checking port 3000...');
    });

    it('should prompt for port if not provided', async () => {
      mockPrompt.mockResolvedValue({ port: 8080 });
      mockPortManager.checkPort.mockResolvedValue([]);

      await cli.handlePortCommand(undefined, {});

      expect(mockPortManager.checkPort).toHaveBeenCalledWith(8080);
    });
  });

  describe('handleError', () => {
    it('should handle ValidationError', () => {
      const error = new ValidationError('Invalid port');
      
      cli.handleError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Validation Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Invalid port');
    });

    it('should handle PermissionError', () => {
      const error = new PermissionError('Access denied');
      
      cli.handleError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Permission Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Access denied');
    });

    it('should handle SystemError', () => {
      const error = new SystemError('System failure');
      
      cli.handleError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ System Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   System failure');
    });

    it('should handle NetworkError', () => {
      const error = new NetworkError('Network failure', 3000, 'port check');
      
      cli.handleError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Network Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Network failure');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Port: 3000');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Operation: port check');
    });

    it('should handle unexpected errors', () => {
      const error = new Error('Unexpected error');
      
      cli.handleError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Unexpected Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   Unexpected error');
    });
  });

  describe('handleSingleProcess', () => {
    it('should kill process when user confirms', async () => {
      const process = { pid: 1234, name: 'node', user: 'testuser' };
      mockPrompt.mockResolvedValue({ kill: true });
      mockPortManager.killProcess.mockResolvedValue(true);

      await cli.handleSingleProcess(process, {});

      expect(mockPortManager.killProcess).toHaveBeenCalledWith(1234);
    });

    it('should not kill process when user declines', async () => {
      const process = { pid: 1234, name: 'node', user: 'testuser' };
      mockPrompt.mockResolvedValue({ kill: false });

      await cli.handleSingleProcess(process, {});

      expect(mockPortManager.killProcess).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('ℹ️  Process not terminated - port remains in use');
    });

    it('should skip prompt with --yes flag', async () => {
      const process = { pid: 1234, name: 'node', user: 'testuser' };
      mockPortManager.killProcess.mockResolvedValue(true);

      await cli.handleSingleProcess(process, { yes: true });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockPortManager.killProcess).toHaveBeenCalledWith(1234);
    });
  });

  describe('handleMultipleProcesses', () => {
    it('should handle multiple processes individually', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'testuser' },
        { pid: 5678, name: 'python', user: 'testuser' }
      ];
      mockPrompt
        .mockResolvedValueOnce({ kill: true })
        .mockResolvedValueOnce({ kill: false });
      mockPortManager.killProcess.mockResolvedValue(true);

      await cli.handleMultipleProcesses(processes, {});

      expect(mockPortManager.killProcess).toHaveBeenCalledWith(1234);
      expect(mockPortManager.killProcess).not.toHaveBeenCalledWith(5678);
      expect(consoleSpy).toHaveBeenCalledWith('ℹ️  Process 5678 (python) not terminated');
    });
  });
});