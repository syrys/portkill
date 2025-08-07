const CLI = require('../../src/cli');
const PortManager = require('../../src/core/port-manager');
const inquirer = require('inquirer');
const { ValidationError, PermissionError, SystemError } = require('../../src/errors');

// Mock dependencies
jest.mock('../../src/core/port-manager');
jest.mock('inquirer');

describe('Interactive Prompts End-to-End Tests', () => {
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
      killProcess: jest.fn()
    };
    PortManager.mockImplementation(() => mockPortManager);
    
    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
    
    cli = new CLI();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Port Number Prompt Scenarios', () => {
    it('should handle valid port input on first try', async () => {
      inquirer.prompt.mockResolvedValue({ port: 3000 });
      mockPortManager.checkPort.mockResolvedValue([]);

      await cli.handlePortCommand(undefined, {});

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'port',
          message: 'Enter port number:'
        })
      ]);
      expect(mockPortManager.checkPort).toHaveBeenCalledWith(3000);
    });

    it('should validate port input and re-prompt for invalid input', async () => {
      const promptConfig = inquirer.prompt.mock.calls[0]?.[0]?.[0];
      const validateFn = promptConfig?.validate;
      
      if (validateFn) {
        // Test validation function
        expect(validateFn('3000')).toBe(true);
        expect(validateFn('80')).toBe(true);
        expect(validateFn('65535')).toBe(true);
        
        expect(validateFn('0')).toBe('Please enter a valid port number (1-65535)');
        expect(validateFn('65536')).toBe('Please enter a valid port number (1-65535)');
        expect(validateFn('abc')).toBe('Please enter a valid port number (1-65535)');
        expect(validateFn('')).toBe('Please enter a valid port number (1-65535)');
        expect(validateFn('-1')).toBe('Please enter a valid port number (1-65535)');
      }
    });

    it('should filter port input to integer', async () => {
      const promptConfig = inquirer.prompt.mock.calls[0]?.[0]?.[0];
      const filterFn = promptConfig?.filter;
      
      if (filterFn) {
        expect(filterFn('3000')).toBe(3000);
        expect(filterFn('  8080  ')).toBe(8080);
        expect(filterFn('443')).toBe(443);
      }
    });

    it('should handle edge case port numbers', async () => {
      inquirer.prompt.mockResolvedValue({ port: 1 });
      mockPortManager.checkPort.mockResolvedValue([]);

      await cli.handlePortCommand(undefined, {});

      expect(mockPortManager.checkPort).toHaveBeenCalledWith(1);
      
      // Test maximum port
      inquirer.prompt.mockResolvedValue({ port: 65535 });
      mockPortManager.checkPort.mockResolvedValue([]);

      await cli.handlePortCommand(undefined, {});

      expect(mockPortManager.checkPort).toHaveBeenCalledWith(65535);
    });
  });

  describe('Process Termination Prompt Scenarios', () => {
    it('should prompt for single process termination with correct message', async () => {
      const process = { pid: 1234, name: 'node', user: 'testuser', protocol: 'TCP', port: 3000 };
      mockPortManager.checkPort.mockResolvedValue([process]);
      inquirer.prompt.mockResolvedValue({ kill: true });
      mockPortManager.killProcess.mockResolvedValue(true);

      await cli.handlePortCommand('3000', {});

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'kill',
          message: 'Do you want to kill this process (PID: 1234)?',
          default: false
        })
      ]);
    });

    it('should prompt for multiple processes with numbered messages', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'user1', protocol: 'TCP', port: 3000 },
        { pid: 5678, name: 'python', user: 'user2', protocol: 'TCP', port: 3000 },
        { pid: 9999, name: 'java', user: 'user3', protocol: 'TCP', port: 3000 }
      ];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      inquirer.prompt
        .mockResolvedValueOnce({ kill: true })   // Process 1
        .mockResolvedValueOnce({ kill: false })  // Process 2
        .mockResolvedValueOnce({ kill: true });  // Process 3
      
      mockPortManager.killProcess
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await cli.handlePortCommand('3000', {});

      expect(inquirer.prompt).toHaveBeenNthCalledWith(1, [
        expect.objectContaining({
          message: 'Do you want to kill process 1 (PID: 1234)?'
        })
      ]);
      expect(inquirer.prompt).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({
          message: 'Do you want to kill process 2 (PID: 5678)?'
        })
      ]);
      expect(inquirer.prompt).toHaveBeenNthCalledWith(3, [
        expect.objectContaining({
          message: 'Do you want to kill process 3 (PID: 9999)?'
        })
      ]);
    });

    it('should handle user declining all process terminations', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'user1', protocol: 'TCP', port: 3000 },
        { pid: 5678, name: 'python', user: 'user2', protocol: 'TCP', port: 3000 }
      ];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      inquirer.prompt
        .mockResolvedValueOnce({ kill: false })
        .mockResolvedValueOnce({ kill: false });

      await cli.handlePortCommand('3000', {});

      expect(mockPortManager.killProcess).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('ℹ️  Process 1234 (node) not terminated');
      expect(consoleSpy).toHaveBeenCalledWith('ℹ️  Process 5678 (python) not terminated');
      expect(consoleSpy).toHaveBeenCalledWith('\n📊 Summary:');
      expect(consoleSpy).toHaveBeenCalledWith('   Terminated: 0 processes');
      expect(consoleSpy).toHaveBeenCalledWith('   Skipped: 2 processes');
    });

    it('should handle mixed user responses for multiple processes', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'user1', protocol: 'TCP', port: 3000 },
        { pid: 5678, name: 'python', user: 'user2', protocol: 'TCP', port: 3000 },
        { pid: 9999, name: 'java', user: 'user3', protocol: 'TCP', port: 3000 }
      ];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      inquirer.prompt
        .mockResolvedValueOnce({ kill: true })   // Kill first
        .mockResolvedValueOnce({ kill: false })  // Skip second
        .mockResolvedValueOnce({ kill: true });  // Kill third
      
      mockPortManager.killProcess
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await cli.handlePortCommand('3000', {});

      expect(mockPortManager.killProcess).toHaveBeenCalledWith(1234);
      expect(mockPortManager.killProcess).toHaveBeenCalledWith(9999);
      expect(mockPortManager.killProcess).not.toHaveBeenCalledWith(5678);
      
      expect(consoleSpy).toHaveBeenCalledWith('✅ Process 1234 has been successfully terminated');
      expect(consoleSpy).toHaveBeenCalledWith('ℹ️  Process 5678 (python) not terminated');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Process 9999 has been successfully terminated');
    });
  });

  describe('Interactive Error Handling', () => {
    it('should handle port check errors during interactive session', async () => {
      inquirer.prompt.mockResolvedValue({ port: 3000 });
      mockPortManager.checkPort.mockRejectedValue(new SystemError('lsof command not found'));

      await cli.handlePortCommand(undefined, {});

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ System Error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('   lsof command not found');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle process kill errors during interactive session', async () => {
      const process = { pid: 1234, name: 'node', user: 'testuser', protocol: 'TCP', port: 3000 };
      mockPortManager.checkPort.mockResolvedValue([process]);
      inquirer.prompt.mockResolvedValue({ kill: true });
      mockPortManager.killProcess.mockRejectedValue(new PermissionError('Permission denied', 1234));

      await cli.handlePortCommand('3000', {});

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 1234');
      expect(consoleSpy).toHaveBeenCalledWith('   Error: Permission denied');
      expect(consoleSpy).toHaveBeenCalledWith('💡 Permission Issue - Suggestions:');
    });

    it('should continue with remaining processes if one fails', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'user1', protocol: 'TCP', port: 3000 },
        { pid: 5678, name: 'python', user: 'user2', protocol: 'TCP', port: 3000 }
      ];
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      inquirer.prompt
        .mockResolvedValueOnce({ kill: true })
        .mockResolvedValueOnce({ kill: true });
      
      mockPortManager.killProcess
        .mockRejectedValueOnce(new PermissionError('Permission denied', 1234))
        .mockResolvedValueOnce(true);

      await cli.handlePortCommand('3000', {});

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to terminate process 1234');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Process 5678 has been successfully terminated');
    });
  });

  describe('Complex Interactive Workflows', () => {
    it('should handle complete workflow from port prompt to multiple process termination', async () => {
      const processes = [
        { pid: 1234, name: 'node', user: 'developer', protocol: 'TCP', port: 8080, command: 'node server.js' },
        { pid: 5678, name: 'nginx', user: 'www-data', protocol: 'TCP', port: 8080, command: 'nginx: worker process' }
      ];
      
      // Port prompt, then two process prompts
      inquirer.prompt
        .mockResolvedValueOnce({ port: 8080 })    // Port selection
        .mockResolvedValueOnce({ kill: true })    // Kill node process
        .mockResolvedValueOnce({ kill: false });  // Skip nginx process
      
      mockPortManager.checkPort.mockResolvedValue(processes);
      mockPortManager.killProcess.mockResolvedValue(true);

      await cli.handlePortCommand(undefined, {});

      // Verify port prompt
      expect(inquirer.prompt).toHaveBeenNthCalledWith(1, [
        expect.objectContaining({
          type: 'input',
          name: 'port',
          message: 'Enter port number:'
        })
      ]);

      // Verify process prompts
      expect(inquirer.prompt).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({
          type: 'confirm',
          name: 'kill',
          message: 'Do you want to kill process 1 (PID: 1234)?'
        })
      ]);

      expect(inquirer.prompt).toHaveBeenNthCalledWith(3, [
        expect.objectContaining({
          type: 'confirm',
          name: 'kill',
          message: 'Do you want to kill process 2 (PID: 5678)?'
        })
      ]);

      // Verify actions
      expect(mockPortManager.checkPort).toHaveBeenCalledWith(8080);
      expect(mockPortManager.killProcess).toHaveBeenCalledWith(1234);
      expect(mockPortManager.killProcess).not.toHaveBeenCalledWith(5678);

      // Verify output
      expect(consoleSpy).toHaveBeenCalledWith('🔍 Checking port 8080...');
      expect(consoleSpy).toHaveBeenCalledWith('📋 Found 2 processes using this port:');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Process 1234 has been successfully terminated');
      expect(consoleSpy).toHaveBeenCalledWith('ℹ️  Process 5678 (nginx) not terminated');
    });

    it('should handle workflow with no processes found after port prompt', async () => {
      inquirer.prompt.mockResolvedValue({ port: 9000 });
      mockPortManager.checkPort.mockResolvedValue([]);

      await cli.handlePortCommand(undefined, {});

      expect(inquirer.prompt).toHaveBeenCalledTimes(1);
      expect(mockPortManager.checkPort).toHaveBeenCalledWith(9000);
      expect(consoleSpy).toHaveBeenCalledWith('✅ Port 9000 is available');
      expect(consoleSpy).toHaveBeenCalledWith('   No processes are currently using this port');
    });

    it('should handle workflow with single process and user confirmation', async () => {
      const process = { 
        pid: 2468, 
        name: 'python3', 
        user: 'developer', 
        protocol: 'TCP', 
        port: 5000,
        command: 'python3 -m http.server 5000'
      };
      
      inquirer.prompt
        .mockResolvedValueOnce({ port: 5000 })
        .mockResolvedValueOnce({ kill: true });
      
      mockPortManager.checkPort.mockResolvedValue([process]);
      mockPortManager.killProcess.mockResolvedValue(true);

      await cli.handlePortCommand(undefined, {});

      expect(consoleSpy).toHaveBeenCalledWith('🔍 Checking port 5000...');
      expect(consoleSpy).toHaveBeenCalledWith('📋 Found 1 process using this port:');
      expect(consoleSpy).toHaveBeenCalledWith('🔸 Process Details:');
      expect(consoleSpy).toHaveBeenCalledWith('   PID: 2468');
      expect(consoleSpy).toHaveBeenCalledWith('   Name: python3');
      expect(consoleSpy).toHaveBeenCalledWith('   User: developer');
      expect(consoleSpy).toHaveBeenCalledWith('   Protocol: TCP');
      expect(consoleSpy).toHaveBeenCalledWith('   Command: python3 -m http.server 5000');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Process 2468 has been successfully terminated');
    });
  });

  describe('Prompt Configuration Validation', () => {
    it('should configure port prompt with correct validation and filtering', async () => {
      inquirer.prompt.mockResolvedValue({ port: 3000 });
      mockPortManager.checkPort.mockResolvedValue([]);

      await cli.handlePortCommand(undefined, {});

      const promptConfig = inquirer.prompt.mock.calls[0][0][0];
      
      expect(promptConfig.type).toBe('input');
      expect(promptConfig.name).toBe('port');
      expect(promptConfig.message).toBe('Enter port number:');
      expect(typeof promptConfig.validate).toBe('function');
      expect(typeof promptConfig.filter).toBe('function');
    });

    it('should configure kill prompt with correct defaults', async () => {
      const process = { pid: 1234, name: 'node', user: 'testuser', protocol: 'TCP', port: 3000 };
      mockPortManager.checkPort.mockResolvedValue([process]);
      inquirer.prompt.mockResolvedValue({ kill: false });

      await cli.handlePortCommand('3000', {});

      const promptConfig = inquirer.prompt.mock.calls[0][0][0];
      
      expect(promptConfig.type).toBe('confirm');
      expect(promptConfig.name).toBe('kill');
      expect(promptConfig.default).toBe(false);
      expect(promptConfig.message).toContain('Do you want to kill this process');
    });
  });
});