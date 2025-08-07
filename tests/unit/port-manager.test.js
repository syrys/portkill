const PortManager = require('../../src/core/port-manager');
const Process = require('../../src/models/process');
const { ValidationError, SystemError, PermissionError } = require('../../src/errors');

// Mock the platform detector
jest.mock('../../src/utils/platform-detector');
const { getPlatformAdapter } = require('../../src/utils/platform-detector');

describe('PortManager', () => {
  let portManager;
  let mockAdapter;

  beforeEach(() => {
    portManager = new PortManager();
    
    // Create mock adapter
    mockAdapter = {
      findProcessByPort: jest.fn(),
      killProcess: jest.fn(),
      getProcessDetails: jest.fn(),
      isCompatible: jest.fn().mockResolvedValue(true)
    };
    
    // Mock getPlatformAdapter to return our mock
    getPlatformAdapter.mockReturnValue(mockAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('should initialize successfully with compatible adapter', async () => {
      await portManager.initialize();
      
      expect(portManager.isInitialized()).toBe(true);
      expect(portManager.getAdapter()).toBe(mockAdapter);
      expect(mockAdapter.isCompatible).toHaveBeenCalled();
    });

    test('should throw SystemError if adapter is not compatible', async () => {
      mockAdapter.isCompatible.mockResolvedValue(false);
      
      await expect(portManager.initialize()).rejects.toThrow(SystemError);
      await expect(portManager.initialize()).rejects.toThrow('Platform adapter is not compatible with current system');
    });

    test('should throw SystemError if getPlatformAdapter fails', async () => {
      getPlatformAdapter.mockImplementation(() => {
        throw new Error('Unsupported platform');
      });
      
      await expect(portManager.initialize()).rejects.toThrow(SystemError);
      await expect(portManager.initialize()).rejects.toThrow('Failed to initialize port manager');
    });

    test('should not reinitialize if already initialized', async () => {
      await portManager.initialize();
      mockAdapter.isCompatible.mockClear();
      
      await portManager.initialize();
      
      expect(mockAdapter.isCompatible).not.toHaveBeenCalled();
    });
  });

  describe('checkPort', () => {
    beforeEach(async () => {
      await portManager.initialize();
    });

    test('should return processes for valid port', async () => {
      const mockProcesses = [
        new Process({
          pid: 1234,
          name: 'node',
          user: 'testuser',
          protocol: 'TCP',
          port: 3000,
          command: 'node server.js'
        })
      ];
      
      mockAdapter.findProcessByPort.mockResolvedValue(mockProcesses);
      
      const result = await portManager.checkPort(3000);
      
      expect(result).toEqual(mockProcesses);
      expect(mockAdapter.findProcessByPort).toHaveBeenCalledWith(3000);
    });

    test('should return empty array when no processes found', async () => {
      mockAdapter.findProcessByPort.mockResolvedValue([]);
      
      const result = await portManager.checkPort(8080);
      
      expect(result).toEqual([]);
      expect(mockAdapter.findProcessByPort).toHaveBeenCalledWith(8080);
    });

    test('should validate port number and convert string to number', async () => {
      mockAdapter.findProcessByPort.mockResolvedValue([]);
      
      await portManager.checkPort('3000');
      
      expect(mockAdapter.findProcessByPort).toHaveBeenCalledWith(3000);
    });

    test('should throw ValidationError for invalid port number', async () => {
      await expect(portManager.checkPort(-1)).rejects.toThrow(ValidationError);
      await expect(portManager.checkPort(0)).rejects.toThrow(ValidationError);
      await expect(portManager.checkPort(65536)).rejects.toThrow(ValidationError);
      await expect(portManager.checkPort('invalid')).rejects.toThrow(ValidationError);
      await expect(portManager.checkPort(null)).rejects.toThrow(ValidationError);
    });

    test('should initialize automatically if not initialized', async () => {
      const uninitializedManager = new PortManager();
      getPlatformAdapter.mockReturnValue(mockAdapter);
      mockAdapter.findProcessByPort.mockResolvedValue([]);
      
      await uninitializedManager.checkPort(3000);
      
      expect(uninitializedManager.isInitialized()).toBe(true);
    });

    test('should propagate SystemError from adapter', async () => {
      const systemError = new SystemError('Command failed', 'lsof -i :3000', 1);
      mockAdapter.findProcessByPort.mockRejectedValue(systemError);
      
      await expect(portManager.checkPort(3000)).rejects.toThrow(SystemError);
      await expect(portManager.checkPort(3000)).rejects.toThrow('Command failed');
    });

    test('should wrap generic errors in SystemError', async () => {
      mockAdapter.findProcessByPort.mockRejectedValue(new Error('Generic error'));
      
      await expect(portManager.checkPort(3000)).rejects.toThrow(SystemError);
      await expect(portManager.checkPort(3000)).rejects.toThrow('Failed to check port 3000');
    });
  });

  describe('killProcess', () => {
    beforeEach(async () => {
      await portManager.initialize();
    });

    test('should successfully kill process', async () => {
      mockAdapter.killProcess.mockResolvedValue(true);
      
      const result = await portManager.killProcess(1234);
      
      expect(result).toBe(true);
      expect(mockAdapter.killProcess).toHaveBeenCalledWith(1234);
    });

    test('should return false if process could not be killed', async () => {
      mockAdapter.killProcess.mockResolvedValue(false);
      
      const result = await portManager.killProcess(1234);
      
      expect(result).toBe(false);
      expect(mockAdapter.killProcess).toHaveBeenCalledWith(1234);
    });

    test('should validate PID and convert string to number', async () => {
      mockAdapter.killProcess.mockResolvedValue(true);
      
      await portManager.killProcess('1234');
      
      expect(mockAdapter.killProcess).toHaveBeenCalledWith(1234);
    });

    test('should throw ValidationError for invalid PID', async () => {
      await expect(portManager.killProcess(-1)).rejects.toThrow(ValidationError);
      await expect(portManager.killProcess(0)).rejects.toThrow(ValidationError);
      await expect(portManager.killProcess('invalid')).rejects.toThrow(ValidationError);
      await expect(portManager.killProcess(null)).rejects.toThrow(ValidationError);
    });

    test('should initialize automatically if not initialized', async () => {
      const uninitializedManager = new PortManager();
      getPlatformAdapter.mockReturnValue(mockAdapter);
      mockAdapter.killProcess.mockResolvedValue(true);
      
      await uninitializedManager.killProcess(1234);
      
      expect(uninitializedManager.isInitialized()).toBe(true);
    });

    test('should propagate PermissionError from adapter', async () => {
      const permissionError = new PermissionError('Permission denied', 1234);
      mockAdapter.killProcess.mockRejectedValue(permissionError);
      
      await expect(portManager.killProcess(1234)).rejects.toThrow(PermissionError);
      await expect(portManager.killProcess(1234)).rejects.toThrow('Permission denied');
    });

    test('should propagate SystemError from adapter', async () => {
      const systemError = new SystemError('Kill command failed', 'kill 1234', 1);
      mockAdapter.killProcess.mockRejectedValue(systemError);
      
      await expect(portManager.killProcess(1234)).rejects.toThrow(SystemError);
      await expect(portManager.killProcess(1234)).rejects.toThrow('Kill command failed');
    });

    test('should wrap generic errors in SystemError', async () => {
      mockAdapter.killProcess.mockRejectedValue(new Error('Generic error'));
      
      await expect(portManager.killProcess(1234)).rejects.toThrow(SystemError);
      await expect(portManager.killProcess(1234)).rejects.toThrow('Failed to kill process 1234');
    });
  });

  describe('getProcessDetails', () => {
    beforeEach(async () => {
      await portManager.initialize();
    });

    test('should return process details for valid PID', async () => {
      const mockDetails = {
        pid: 1234,
        name: 'node',
        user: 'testuser',
        command: 'node server.js'
      };
      
      mockAdapter.getProcessDetails.mockResolvedValue(mockDetails);
      
      const result = await portManager.getProcessDetails(1234);
      
      expect(result).toEqual(mockDetails);
      expect(mockAdapter.getProcessDetails).toHaveBeenCalledWith(1234);
    });

    test('should validate PID and convert string to number', async () => {
      const mockDetails = { pid: 1234, name: 'test', user: 'user', command: 'test' };
      mockAdapter.getProcessDetails.mockResolvedValue(mockDetails);
      
      await portManager.getProcessDetails('1234');
      
      expect(mockAdapter.getProcessDetails).toHaveBeenCalledWith(1234);
    });

    test('should throw ValidationError for invalid PID', async () => {
      await expect(portManager.getProcessDetails(-1)).rejects.toThrow(ValidationError);
      await expect(portManager.getProcessDetails(0)).rejects.toThrow(ValidationError);
      await expect(portManager.getProcessDetails('invalid')).rejects.toThrow(ValidationError);
      await expect(portManager.getProcessDetails(null)).rejects.toThrow(ValidationError);
    });

    test('should initialize automatically if not initialized', async () => {
      const uninitializedManager = new PortManager();
      getPlatformAdapter.mockReturnValue(mockAdapter);
      const mockDetails = { pid: 1234, name: 'test', user: 'user', command: 'test' };
      mockAdapter.getProcessDetails.mockResolvedValue(mockDetails);
      
      await uninitializedManager.getProcessDetails(1234);
      
      expect(uninitializedManager.isInitialized()).toBe(true);
    });

    test('should propagate SystemError from adapter', async () => {
      const systemError = new SystemError('Process not found', 'ps -p 1234', 1);
      mockAdapter.getProcessDetails.mockRejectedValue(systemError);
      
      await expect(portManager.getProcessDetails(1234)).rejects.toThrow(SystemError);
      await expect(portManager.getProcessDetails(1234)).rejects.toThrow('Process not found');
    });

    test('should wrap generic errors in SystemError', async () => {
      mockAdapter.getProcessDetails.mockRejectedValue(new Error('Generic error'));
      
      await expect(portManager.getProcessDetails(1234)).rejects.toThrow(SystemError);
      await expect(portManager.getProcessDetails(1234)).rejects.toThrow('Failed to get process details for PID 1234');
    });
  });

  describe('isPortAvailable', () => {
    beforeEach(async () => {
      await portManager.initialize();
    });

    test('should return true when no processes found on port', async () => {
      mockAdapter.findProcessByPort.mockResolvedValue([]);
      
      const result = await portManager.isPortAvailable(3000);
      
      expect(result).toBe(true);
      expect(mockAdapter.findProcessByPort).toHaveBeenCalledWith(3000);
    });

    test('should return false when processes found on port', async () => {
      const mockProcesses = [
        new Process({
          pid: 1234,
          name: 'node',
          user: 'testuser',
          protocol: 'TCP',
          port: 3000,
          command: 'node server.js'
        })
      ];
      
      mockAdapter.findProcessByPort.mockResolvedValue(mockProcesses);
      
      const result = await portManager.isPortAvailable(3000);
      
      expect(result).toBe(false);
      expect(mockAdapter.findProcessByPort).toHaveBeenCalledWith(3000);
    });

    test('should validate port number', async () => {
      await expect(portManager.isPortAvailable(-1)).rejects.toThrow(ValidationError);
      await expect(portManager.isPortAvailable('invalid')).rejects.toThrow(ValidationError);
    });
  });

  describe('utility methods', () => {
    test('getAdapter should return null when not initialized', () => {
      expect(portManager.getAdapter()).toBeNull();
    });

    test('getAdapter should return adapter when initialized', async () => {
      await portManager.initialize();
      expect(portManager.getAdapter()).toBe(mockAdapter);
    });

    test('isInitialized should return false initially', () => {
      expect(portManager.isInitialized()).toBe(false);
    });

    test('isInitialized should return true after initialization', async () => {
      await portManager.initialize();
      expect(portManager.isInitialized()).toBe(true);
    });
  });

  describe('error handling scenarios', () => {
    test('should handle adapter initialization failure gracefully', async () => {
      mockAdapter.isCompatible.mockRejectedValue(new Error('Compatibility check failed'));
      
      await expect(portManager.initialize()).rejects.toThrow(SystemError);
      await expect(portManager.initialize()).rejects.toThrow('Failed to initialize port manager');
    });

    test('should handle multiple processes on same port', async () => {
      const mockProcesses = [
        new Process({
          pid: 1234,
          name: 'node',
          user: 'user1',
          protocol: 'TCP',
          port: 3000,
          command: 'node server.js'
        }),
        new Process({
          pid: 5678,
          name: 'python',
          user: 'user2',
          protocol: 'TCP',
          port: 3000,
          command: 'python app.py'
        })
      ];
      
      mockAdapter.findProcessByPort.mockResolvedValue(mockProcesses);
      
      const result = await portManager.checkPort(3000);
      
      expect(result).toHaveLength(2);
      expect(result).toEqual(mockProcesses);
    });

    test('should handle edge case port numbers', async () => {
      mockAdapter.findProcessByPort.mockResolvedValue([]);
      
      // Test minimum valid port
      await portManager.checkPort(1);
      expect(mockAdapter.findProcessByPort).toHaveBeenCalledWith(1);
      
      // Test maximum valid port
      await portManager.checkPort(65535);
      expect(mockAdapter.findProcessByPort).toHaveBeenCalledWith(65535);
    });
  });
});