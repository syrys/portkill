const Process = require('../../../src/models/process');
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
const WindowsAdapter = require('../../../src/adapters/windows-adapter');

describe('WindowsAdapter', () => {
  let adapter;
  
  beforeEach(() => {
    adapter = WindowsAdapter;
    jest.clearAllMocks();
  });

  describe('findProcessByPort', () => {
    it('should find processes running on specified port', async () => {
      const mockNetstatOutput = `  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    127.0.0.1:3000         127.0.0.1:54321        ESTABLISHED     5678`;

      const mockTasklistOutput1 = '"node.exe","1234","Console","1","25,000 K"';
      const mockTasklistOutput2 = '"node.exe","5678","Console","1","30,000 K"';

      let execCallCount = 0;
      mockExecAsync.mockImplementation((command) => {
        execCallCount++;
        if (command.includes('netstat -ano')) {
          return Promise.resolve({ stdout: mockNetstatOutput, stderr: '' });
        } else if (command.includes('tasklist /FI "PID eq 1234"')) {
          return Promise.resolve({ stdout: mockTasklistOutput1, stderr: '' });
        } else if (command.includes('tasklist /FI "PID eq 5678"')) {
          return Promise.resolve({ stdout: mockTasklistOutput2, stderr: '' });
        }
      });

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(2);
      expect(processes[0]).toBeInstanceOf(Process);
      expect(processes[0].pid).toBe(1234);
      expect(processes[0].name).toBe('node.exe');
      expect(processes[0].protocol).toBe('TCP');
      expect(processes[0].port).toBe(3000);
      expect(processes[1].pid).toBe(5678);
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

    it('should handle UDP processes', async () => {
      const mockNetstatOutput = `  UDP    0.0.0.0:3000           *:*                                    1234`;
      const mockTasklistOutput = '"node.exe","1234","Console","1","25,000 K"';

      mockExecAsync.mockImplementation((command) => {
        if (command.includes('netstat -ano')) {
          return Promise.resolve({ stdout: mockNetstatOutput, stderr: '' });
        } else if (command.includes('tasklist')) {
          return Promise.resolve({ stdout: mockTasklistOutput, stderr: '' });
        }
      });

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
      expect(processes[0].protocol).toBe('UDP');
    });

    it('should handle malformed netstat output gracefully', async () => {
      const mockNetstatOutput = `invalid line with not enough parts
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234`;
      const mockTasklistOutput = '"node.exe","1234","Console","1","25,000 K"';

      mockExecAsync.mockImplementation((command) => {
        if (command.includes('netstat -ano')) {
          return Promise.resolve({ stdout: mockNetstatOutput, stderr: '' });
        } else if (command.includes('tasklist')) {
          return Promise.resolve({ stdout: mockTasklistOutput, stderr: '' });
        }
      });

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
    });

    it('should skip processes with invalid PIDs', async () => {
      const mockNetstatOutput = `  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       abc
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234`;
      const mockTasklistOutput = '"node.exe","1234","Console","1","25,000 K"';

      mockExecAsync.mockImplementation((command) => {
        if (command.includes('netstat -ano')) {
          return Promise.resolve({ stdout: mockNetstatOutput, stderr: '' });
        } else if (command.includes('tasklist')) {
          return Promise.resolve({ stdout: mockTasklistOutput, stderr: '' });
        }
      });

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
    });

    it('should handle duplicate PIDs', async () => {
      const mockNetstatOutput = `  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    127.0.0.1:3000         127.0.0.1:54321        ESTABLISHED     1234`;
      const mockTasklistOutput = '"node.exe","1234","Console","1","25,000 K"';

      mockExecAsync.mockImplementation((command) => {
        if (command.includes('netstat -ano')) {
          return Promise.resolve({ stdout: mockNetstatOutput, stderr: '' });
        } else if (command.includes('tasklist')) {
          return Promise.resolve({ stdout: mockTasklistOutput, stderr: '' });
        }
      });

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(1); // Should only include one instance of PID 1234
      expect(processes[0].pid).toBe(1234);
    });

    it('should create basic process object when tasklist fails', async () => {
      const mockNetstatOutput = `  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234`;

      mockExecAsync.mockImplementation((command) => {
        if (command.includes('netstat -ano')) {
          return Promise.resolve({ stdout: mockNetstatOutput, stderr: '' });
        } else if (command.includes('tasklist')) {
          const error = new Error('Access denied');
          return Promise.reject(error);
        }
      });

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
      expect(processes[0].name).toBe('Unknown');
      expect(processes[0].user).toBe('Unknown');
    });

    it('should filter by port correctly', async () => {
      const mockNetstatOutput = `  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       1111
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:9000           0.0.0.0:0              LISTENING       2222`;
      const mockTasklistOutput = '"node.exe","1234","Console","1","25,000 K"';

      mockExecAsync.mockImplementation((command) => {
        if (command.includes('netstat -ano')) {
          return Promise.resolve({ stdout: mockNetstatOutput, stderr: '' });
        } else if (command.includes('tasklist')) {
          return Promise.resolve({ stdout: mockTasklistOutput, stderr: '' });
        }
      });

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
      expect(processes[0].port).toBe(3000);
    });

    it('should handle system errors during netstat execution', async () => {
      const error = new Error('System error');
      error.code = 2;
      mockExecAsync.mockRejectedValue(error);

      await expect(adapter.findProcessByPort(3000)).rejects.toThrow(SystemError);
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow('Failed to find processes on port 3000');
    });

    it('should handle permission denied errors', async () => {
      const error = new Error('Command failed');
      error.code = 1;
      error.stdout = 'some output'; // Ensure stdout is not empty so it doesn't return []
      error.stderr = 'Access is denied';
      mockExecAsync.mockRejectedValue(error);
      
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow(PermissionError);
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow('Permission denied when checking port');
    });

    it('should handle invalid port errors', async () => {
      const error = new Error('Command failed');
      error.code = 1;
      error.stdout = 'some output'; // Ensure stdout is not empty so it doesn't return []
      error.stderr = 'netstat: invalid port specification';
      mockExecAsync.mockRejectedValue(error);
      
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow(ValidationError);
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow('Invalid port number');
    });

    it('should handle missing system commands', async () => {
      const error = new Error('Command failed');
      error.code = 1;
      error.stdout = 'some output'; // Ensure stdout is not empty so it doesn't return []
      error.stderr = 'netstat is not recognized as an internal or external command';
      mockExecAsync.mockRejectedValue(error);
      
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow(SystemError);
      await expect(adapter.findProcessByPort(3000)).rejects.toThrow('Required system command not found');
    });

    it('should handle processes with zero or negative PIDs', async () => {
      const mockNetstatOutput = `  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       0
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       -1
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234`;
      const mockTasklistOutput = '"node.exe","1234","Console","1","25,000 K"';

      mockExecAsync.mockImplementation((command) => {
        if (command.includes('netstat -ano')) {
          return Promise.resolve({ stdout: mockNetstatOutput, stderr: '' });
        } else if (command.includes('tasklist')) {
          return Promise.resolve({ stdout: mockTasklistOutput, stderr: '' });
        }
      });

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(1); // Should only include valid PID 1234
      expect(processes[0].pid).toBe(1234);
    });

    it('should handle UDP processes correctly', async () => {
      const mockNetstatOutput = `  UDP    0.0.0.0:3000           *:*                                    1234`;
      const mockTasklistOutput = '"node.exe","1234","Console","1","25,000 K"';

      mockExecAsync.mockImplementation((command) => {
        if (command.includes('netstat -ano')) {
          return Promise.resolve({ stdout: mockNetstatOutput, stderr: '' });
        } else if (command.includes('tasklist')) {
          return Promise.resolve({ stdout: mockTasklistOutput, stderr: '' });
        }
      });

      const processes = await adapter.findProcessByPort(3000);

      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
      expect(processes[0].protocol).toBe('UDP');
    });
  });

  describe('getProcessDetails', () => {
    it('should get detailed process information', async () => {
      const mockTasklistOutput = '"node.exe","1234","Console","1","25,000 K"';

      mockExecAsync.mockResolvedValue({ stdout: mockTasklistOutput, stderr: '' });

      const details = await adapter.getProcessDetails(1234);

      expect(details).toEqual({
        pid: 1234,
        user: 'Console',
        name: 'node.exe',
        command: 'node.exe'
      });
    });

    it('should handle system processes', async () => {
      const mockTasklistOutput = '"svchost.exe","1234","Services","0","15,000 K"';

      mockExecAsync.mockResolvedValue({ stdout: mockTasklistOutput, stderr: '' });

      const details = await adapter.getProcessDetails(1234);

      expect(details).toEqual({
        pid: 1234,
        user: 'SYSTEM',
        name: 'svchost.exe',
        command: 'svchost.exe'
      });
    });

    it('should handle process not found', async () => {
      const error = new Error('Command failed');
      error.code = 1;
      mockExecAsync.mockRejectedValue(error);

      await expect(adapter.getProcessDetails(9999)).rejects.toThrow(SystemError);
      await expect(adapter.getProcessDetails(9999)).rejects.toThrow('Process with PID 9999 not found');
    });

    it('should handle empty tasklist output', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await expect(adapter.getProcessDetails(1234)).rejects.toThrow(SystemError);
      await expect(adapter.getProcessDetails(1234)).rejects.toThrow('Process with PID 1234 not found');
    });

    it('should handle invalid tasklist output format', async () => {
      const mockTasklistOutput = 'invalid output format';

      mockExecAsync.mockResolvedValue({ stdout: mockTasklistOutput, stderr: '' });

      await expect(adapter.getProcessDetails(1234)).rejects.toThrow(SystemError);
      await expect(adapter.getProcessDetails(1234)).rejects.toThrow('Invalid tasklist output format');
    });

    it('should handle unexpected tasklist errors', async () => {
      const error = new Error('Unexpected error');
      error.code = 2;
      mockExecAsync.mockRejectedValue(error);

      await expect(adapter.getProcessDetails(1234)).rejects.toThrow(SystemError);
      await expect(adapter.getProcessDetails(1234)).rejects.toThrow('Failed to get process details for PID 1234');
    });
  });

  describe('killProcess', () => {
    beforeEach(() => {
      // Mock sleep function to speed up tests
      jest.spyOn(adapter, '_sleep').mockResolvedValue();
    });

    it('should successfully kill process without force', async () => {
      let killCallCount = 0;
      
      mockExecAsync.mockImplementation((command) => {
        if (command.includes('taskkill /PID') && !command.includes('/F')) {
          killCallCount++;
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (command.includes('tasklist /FI "PID eq')) {
          // First call returns process exists, second call returns empty (process killed)
          if (killCallCount === 1) {
            return Promise.resolve({ stdout: '', stderr: '' }); // Process killed
          }
        }
      });

      const result = await adapter.killProcess(1234);

      expect(result).toBe(true);
    });

    it('should force kill if graceful termination fails', async () => {
      let gracefulCalled = false;
      let forceCalled = false;
      
      mockExecAsync.mockImplementation((command) => {
        if (command.includes('taskkill /PID') && !command.includes('/F')) {
          gracefulCalled = true;
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (command.includes('taskkill /PID') && command.includes('/F')) {
          forceCalled = true;
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (command.includes('tasklist /FI "PID eq')) {
          if (!forceCalled) {
            // Process still running after graceful kill
            return Promise.resolve({ stdout: '"node.exe","1234","Console","1","25,000 K"', stderr: '' });
          } else {
            // Process killed after force kill
            return Promise.resolve({ stdout: '', stderr: '' });
          }
        }
      });

      const result = await adapter.killProcess(1234);

      expect(result).toBe(true);
      expect(gracefulCalled).toBe(true);
      expect(forceCalled).toBe(true);
    });

    it('should handle permission denied error', async () => {
      mockExecAsync.mockImplementation((command) => {
        if (command.includes('taskkill')) {
          const error = new Error('Command failed');
          error.code = 128;
          error.stderr = 'ERROR: Access is denied';
          return Promise.reject(error);
        }
      });

      await expect(adapter.killProcess(1234)).rejects.toThrow(PermissionError);
      await expect(adapter.killProcess(1234)).rejects.toThrow('Permission denied when trying to kill process 1234');
    });

    it('should handle process already terminated', async () => {
      mockExecAsync.mockImplementation((command) => {
        if (command.includes('taskkill')) {
          const error = new Error('Command failed');
          error.code = 128;
          error.stderr = 'ERROR: The process "1234" not found';
          return Promise.reject(error);
        } else if (command.includes('tasklist')) {
          return Promise.resolve({ stdout: '', stderr: '' }); // Process not found
        }
      });

      const result = await adapter.killProcess(1234);

      expect(result).toBe(true);
    });

    it('should return false if process cannot be killed', async () => {
      mockExecAsync.mockImplementation((command) => {
        if (command.includes('taskkill')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        } else if (command.includes('tasklist')) {
          // Process still running after both kill attempts
          return Promise.resolve({ stdout: '"node.exe","1234","Console","1","25,000 K"', stderr: '' });
        }
      });

      const result = await adapter.killProcess(1234);

      expect(result).toBe(false);
    });

    it('should handle unexpected taskkill command errors', async () => {
      mockExecAsync.mockImplementation((command) => {
        if (command.includes('taskkill')) {
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
      mockExecAsync.mockResolvedValue({ stdout: '"node.exe","1234","Console","1","25,000 K"', stderr: '' });

      const isRunning = await adapter._isProcessRunning(1234);

      expect(isRunning).toBe(true);
    });

    it('should return false when process is not running', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const isRunning = await adapter._isProcessRunning(1234);

      expect(isRunning).toBe(false);
    });

    it('should return false when tasklist returns no tasks message', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'INFO: No tasks are running which match the specified criteria.', stderr: '' });

      const isRunning = await adapter._isProcessRunning(1234);

      expect(isRunning).toBe(false);
    });

    it('should return false when tasklist command fails', async () => {
      const error = new Error('Command failed');
      mockExecAsync.mockRejectedValue(error);

      const isRunning = await adapter._isProcessRunning(1234);

      expect(isRunning).toBe(false);
    });
  });

  describe('isCompatible', () => {
    it('should return true for Windows platform', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const compatible = await adapter.isCompatible();

      expect(compatible).toBe(true);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return false for Linux platform', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const compatible = await adapter.isCompatible();

      expect(compatible).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return false for macOS platform', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const compatible = await adapter.isCompatible();

      expect(compatible).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});