const { Process } = require('../../../src/models/process');
const { SystemError, PermissionError, ValidationError } = require('../../../src/errors');

// Mock child_process before requiring the adapter
const mockExec = jest.fn();
jest.mock('child_process', () => ({
  exec: mockExec
}));

// Mock util.promisify to return our mock function
const mockExecAsync = jest.fn();
jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecAsync)
}));

// Now require the adapter after mocking
const { UnixAdapter } = require('../../../src/adapters/unix-adapter');

describe('UnixAdapter', () => {
  let adapter;
  
  beforeEach(() => {
    adapter = new UnixAdapter();
    jest.clearAllMocks();
  });

  describe('findProcessByPort', () => {
    it('should find processes running on specified port', async () => {
      const mockLsofOutput = `COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node     1234 user   20u  IPv4  12345      0t0  TCP *:3000 (LISTEN)
node     5678 user   21u  IPv4  12346      0t0  TCP 127.0.0.1:3000->127.0.0.1:54321 (ESTABLISHED)`;

      mockExecAsync.mockResolvedValue({ stdout: mockLsofOutput, stderr: '' });

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(2);
      expect(processes[0]).toBeInstanceOf(Process);
      expect(processes[0].pid).toBe(1234);
      expect(processes[0].name).toBe('node');
      expect(processes[0].user).toBe('user');
      expect(processes[0].protocol).toBe('TCP');
      expect(processes[0].port).toBe(3000);
    });

    it('should return empty array when no processes found', async () => {
      const error = new Error('Command failed');
      error.code = 1;
      error.stdout = '';
      error.stderr = '';
      mockExecAsync.mockRejectedValue(error);

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(0);
    });

    it('should handle lsof command not found', async () => {
      const error = new Error('Command failed');
      error.code = 1;
      error.stderr = 'lsof: No such file or directory';
      mockExecAsync.mockRejectedValue(error);

      await expect(adapter.findProcessByPort(3000)).rejects.toThrow(SystemError);
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow('lsof command not found');
    });

    it('should handle malformed lsof output gracefully', async () => {
      const mockLsofOutput = `COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
invalid line with not enough parts
node     1234 user   20u  IPv4  12345      0t0  TCP *:3000 (LISTEN)`;

      mockExecAsync.mockResolvedValue({ stdout: mockLsofOutput, stderr: '' });

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
    });

    it('should skip processes with invalid PIDs', async () => {
      const mockLsofOutput = `COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node     abc user   20u  IPv4  12345      0t0  TCP *:3000 (LISTEN)
node     1234 user   21u  IPv4  12346      0t0  TCP *:3000 (LISTEN)`;

      mockExecAsync.mockResolvedValue({ stdout: mockLsofOutput, stderr: '' });

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
    });

    it('should handle system errors during lsof execution', async () => {
      const error = new Error('System error');
      error.code = 2;
      mockExecAsync.mockRejectedValue(error);

      await expect(adapter.findProcessByPort(3000)).rejects.toThrow(SystemError);
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow('Failed to find processes on port 3000');
    });

    it('should handle duplicate PIDs from multiple connections', async () => {
      const mockLsofOutput = `COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node     1234 user   10u  IPv4  12345      0t0  TCP *:3000 (LISTEN)
node     1234 user   11u  IPv4  12346      0t0  TCP 127.0.0.1:3000->127.0.0.1:54321 (ESTABLISHED)`;
      
      mockExecAsync.mockResolvedValue({ stdout: mockLsofOutput, stderr: '' });
      
      const processes = await adapter.findProcessByPort(3000);
      
      expect(processes).toHaveLength(1); // Should deduplicate by PID
      expect(processes[0].pid).toBe(1234);
      expect(processes[0].name).toBe('node');
    });

    it('should handle processes with minimal information', async () => {
      const mockLsofOutput = `COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
unknown  1234 unknown 10u  IPv4  12345      0t0  TCP *:3000 (LISTEN)`;
      
      mockExecAsync.mockResolvedValue({ stdout: mockLsofOutput, stderr: '' });
      
      const processes = await adapter.findProcessByPort(3000);
      
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
      expect(processes[0].name).toBe('unknown');
      expect(processes[0].user).toBe('unknown');
    });

    it('should handle permission denied errors', async () => {
      const error = new Error('Command failed');
      error.code = 1;
      error.stdout = 'some output'; // Ensure stdout is not empty so it doesn't return []
      error.stderr = 'lsof: Permission denied';
      mockExecAsync.mockRejectedValue(error);
      
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow(PermissionError);
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow('Permission denied when checking port');
    });

    it('should handle invalid port errors', async () => {
      const error = new Error('Command failed');
      error.code = 1;
      error.stdout = 'some output'; // Ensure stdout is not empty so it doesn't return []
      error.stderr = 'lsof: invalid port specification';
      mockExecAsync.mockRejectedValue(error);
      
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow(ValidationError);
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow('Invalid port number');
    });

    it('should filter out non-relevant connections', async () => {
      const mockLsofOutput = `COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node     1234 user   10u  IPv4  12345      0t0  TCP *:3000 (LISTEN)
node     5678 user   11u  IPv4  12346      0t0  TCP 127.0.0.1:3000->127.0.0.1:54321 (ESTABLISHED)
node     9999 user   12u  IPv4  12347      0t0  TCP 127.0.0.1:3000->127.0.0.1:54322 (CLOSE_WAIT)`;
      
      mockExecAsync.mockResolvedValue({ stdout: mockLsofOutput, stderr: '' });
      
      const processes = await adapter.findProcessByPort(3000);
      
      expect(processes).toHaveLength(2); // Should only include LISTEN and ESTABLISHED
      expect(processes.map(p => p.pid)).toEqual([1234, 5678]);
    });
  });

  describe('getProcessDetails', () => {
    it('should get detailed process information', async () => {
      const mockPsOutput = '1234 user node /usr/bin/node server.js';

      mockExecAsync.mockResolvedValue({ stdout: mockPsOutput, stderr: '' });

      const details = await adapter.getProcessDetails(1234);

      expect(details).toEqual({
        pid: 1234,
        user: 'user',
        name: 'node',
        command: '/usr/bin/node server.js'
      });
    });

    it('should handle process not found', async () => {
      const error = new Error('Command failed');
      error.code = 1;
      mockExecAsync.mockRejectedValue(error);

      await expect(adapter.getProcessDetails(9999)).rejects.toThrow(SystemError);
      await expect(adapter.getProcessDetails(9999)).rejects.toThrow('Process with PID 9999 not found');
    });

    it('should handle empty ps output', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await expect(adapter.getProcessDetails(1234)).rejects.toThrow(SystemError);
      await expect(adapter.getProcessDetails(1234)).rejects.toThrow('Process with PID 1234 not found');
    });

    it('should handle invalid ps output format', async () => {
      const mockPsOutput = '1234 user'; // Missing required fields

      mockExecAsync.mockResolvedValue({ stdout: mockPsOutput, stderr: '' });

      await expect(adapter.getProcessDetails(1234)).rejects.toThrow(SystemError);
      await expect(adapter.getProcessDetails(1234)).rejects.toThrow('Invalid ps output format');
    });

    it('should handle command with no arguments', async () => {
      const mockPsOutput = '1234 user node node';

      mockExecAsync.mockResolvedValue({ stdout: mockPsOutput, stderr: '' });

      const details = await adapter.getProcessDetails(1234);

      expect(details.command).toBe('node');
    });
  });

  describe('killProcess', () => {
    beforeEach(() => {
      // Mock sleep function to speed up tests
      jest.spyOn(adapter, '_sleep').mockResolvedValue();
    });

    it('should successfully kill process with SIGTERM', async () => {
      let killCallCount = 0;
      
      mockExecAsync.mockImplementation((command) => {
        if (command.includes('kill -TERM')) {
          killCallCount++;
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (command.includes('ps -p')) {
          // First call returns process exists, second call returns empty (process killed)
          if (killCallCount === 1) {
            return Promise.resolve({ stdout: '', stderr: '' }); // Process killed
          }
        }
      });

      const result = await adapter.killProcess(1234);

      expect(result).toBe(true);
    });

    it('should force kill with SIGKILL if SIGTERM fails', async () => {
      let termCalled = false;
      let killCalled = false;
      
      mockExecAsync.mockImplementation((command) => {
        if (command.includes('kill -TERM')) {
          termCalled = true;
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (command.includes('kill -KILL')) {
          killCalled = true;
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (command.includes('ps -p')) {
          if (!killCalled) {
            // Process still running after SIGTERM
            return Promise.resolve({ stdout: '1234 user node', stderr: '' });
          } else {
            // Process killed after SIGKILL
            return Promise.resolve({ stdout: '', stderr: '' });
          }
        }
      });

      const result = await adapter.killProcess(1234);

      expect(result).toBe(true);
      expect(termCalled).toBe(true);
      expect(killCalled).toBe(true);
    });

    it('should handle permission denied error', async () => {
      mockExecAsync.mockImplementation((command) => {
        if (command.includes('kill -TERM')) {
          const error = new Error('Command failed');
          error.code = 1;
          error.stderr = 'kill: 1234: Operation not permitted';
          return Promise.reject(error);
        }
      });

      await expect(adapter.killProcess(1234)).rejects.toThrow(PermissionError);
      await expect(adapter.killProcess(1234)).rejects.toThrow('Permission denied when trying to kill process 1234');
    });

    it('should handle process already terminated', async () => {
      mockExecAsync.mockImplementation((command) => {
        if (command.includes('kill -TERM')) {
          const error = new Error('Command failed');
          error.code = 1;
          error.stderr = 'kill: 1234: No such process';
          return Promise.reject(error);
        } else if (command.includes('ps -p')) {
          return Promise.resolve({ stdout: '', stderr: '' }); // Process not found
        }
      });

      const result = await adapter.killProcess(1234);

      expect(result).toBe(true);
    });

    it('should return false if process cannot be killed', async () => {
      mockExecAsync.mockImplementation((command) => {
        if (command.includes('kill')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (command.includes('ps -p')) {
          // Process still running after both kill attempts
          return Promise.resolve({ stdout: '1234 user node', stderr: '' });
        }
      });

      const result = await adapter.killProcess(1234);

      expect(result).toBe(false);
    });

    it('should handle unexpected kill command errors', async () => {
      mockExecAsync.mockImplementation((command) => {
        if (command.includes('kill -TERM')) {
          const error = new Error('Unexpected error');
          error.code = 2;
          return Promise.reject(error);
        }
      });

      await expect(adapter.killProcess(1234)).rejects.toThrow(SystemError);
      await expect(adapter.killProcess(1234)).rejects.toThrow('Failed to kill process 1234');
    });
  });

  describe('_isProcessRunning', () => {
    it('should return true when process is running', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '1234 user node', stderr: '' });

      const isRunning = await adapter._isProcessRunning(1234);

      expect(isRunning).toBe(true);
    });

    it('should return false when process is not running', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const isRunning = await adapter._isProcessRunning(1234);

      expect(isRunning).toBe(false);
    });

    it('should return false when ps command fails', async () => {
      const error = new Error('Command failed');
      mockExecAsync.mockRejectedValue(error);

      const isRunning = await adapter._isProcessRunning(1234);

      expect(isRunning).toBe(false);
    });
  });

  describe('isCompatible', () => {
    it('should return true for Linux platform', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const compatible = await adapter.isCompatible();

      expect(compatible).toBe(true);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return true for macOS platform', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const compatible = await adapter.isCompatible();

      expect(compatible).toBe(true);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return false for Windows platform', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const compatible = await adapter.isCompatible();

      expect(compatible).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});