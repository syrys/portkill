const PlatformDetector = require('../../src/utils/platform-detector');

// Mock os module for platform detection
jest.mock('os');
const os = require('os');

describe('Cross-Platform Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Platform Detection Integration', () => {
    it('should detect Windows platform correctly', () => {
      os.platform.mockReturnValue('win32');
      
      const platform = PlatformDetector.detectPlatform();
      expect(platform).toBe('windows');
    });

    it('should detect Unix platforms correctly', () => {
      // Test Linux
      os.platform.mockReturnValue('linux');
      const linuxPlatform = PlatformDetector.detectPlatform();
      expect(linuxPlatform).toBe('unix');

      // Test macOS
      os.platform.mockReturnValue('darwin');
      const macosPlatform = PlatformDetector.detectPlatform();
      expect(macosPlatform).toBe('unix');
    });

    it('should throw error for unsupported platform', () => {
      os.platform.mockReturnValue('freebsd');

      expect(() => {
        PlatformDetector.detectPlatform();
      }).toThrow('Unsupported platform: freebsd');
    });

    it('should return appropriate adapter for Windows', () => {
      os.platform.mockReturnValue('win32');
      
      const adapter = PlatformDetector.getPlatformAdapter();
      expect(adapter).toBeDefined();
      expect(typeof adapter.findProcessByPort).toBe('function');
      expect(typeof adapter.killProcess).toBe('function');
      expect(typeof adapter.isCompatible).toBe('function');
    });

    it('should return appropriate adapter for Unix', () => {
      os.platform.mockReturnValue('linux');
      
      const adapter = PlatformDetector.getPlatformAdapter();
      expect(adapter).toBeDefined();
      expect(typeof adapter.findProcessByPort).toBe('function');
      expect(typeof adapter.killProcess).toBe('function');
      expect(typeof adapter.isCompatible).toBe('function');
    });
  });


});