const os = require('os');
const platformDetector = require('../../../src/utils/platform-detector');

// Mock the os module
jest.mock('os');

describe('Platform Detector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectPlatform', () => {
    it('should return "windows" for win32 platform', () => {
      os.platform.mockReturnValue('win32');
      
      const result = platformDetector.detectPlatform();
      
      expect(result).toBe('windows');
    });

    it('should return "unix" for linux platform', () => {
      os.platform.mockReturnValue('linux');
      
      const result = platformDetector.detectPlatform();
      
      expect(result).toBe('unix');
    });

    it('should return "unix" for darwin platform', () => {
      os.platform.mockReturnValue('darwin');
      
      const result = platformDetector.detectPlatform();
      
      expect(result).toBe('unix');
    });

    it('should throw error for unsupported platform', () => {
      os.platform.mockReturnValue('freebsd');
      
      expect(() => {
        platformDetector.detectPlatform();
      }).toThrow('Unsupported platform: freebsd');
    });
  });

  describe('getPlatformAdapter', () => {
    it('should return windows adapter for win32 platform', () => {
      os.platform.mockReturnValue('win32');
      
      const adapter = platformDetector.getPlatformAdapter();
      
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('WindowsAdapter');
    });

    it('should return unix adapter for linux platform', () => {
      os.platform.mockReturnValue('linux');
      
      const adapter = platformDetector.getPlatformAdapter();
      
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('UnixAdapter');
    });

    it('should return unix adapter for darwin platform', () => {
      os.platform.mockReturnValue('darwin');
      
      const adapter = platformDetector.getPlatformAdapter();
      
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('UnixAdapter');
    });

    it('should throw error for unsupported platform', () => {
      os.platform.mockReturnValue('freebsd');
      
      expect(() => {
        platformDetector.getPlatformAdapter();
      }).toThrow('Unsupported platform: freebsd');
    });
  });
});