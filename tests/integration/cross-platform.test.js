// Mock the os module
const mockPlatform = jest.fn();
jest.mock('os', () => ({
  platform: mockPlatform
}));

const PlatformDetector = require('../../src/utils/platform-detector');

describe('Cross-Platform Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Platform Detection Integration', () => {
    it('should detect Windows platform correctly', () => {
      mockPlatform.mockReturnValue('win32');
      
      const platform = PlatformDetector.detectPlatform();
      expect(platform).toBe('windows');
    });

    it('should detect Unix platforms correctly', () => {
      // Test Linux
      mockPlatform.mockReturnValue('linux');
      const linuxPlatform = PlatformDetector.detectPlatform();
      expect(linuxPlatform).toBe('unix');

      // Test macOS
      mockPlatform.mockReturnValue('darwin');
      const macosPlatform = PlatformDetector.detectPlatform();
      expect(macosPlatform).toBe('unix');
    });

    it('should throw error for unsupported platform', () => {
      mockPlatform.mockReturnValue('freebsd');

      expect(() => {
        PlatformDetector.detectPlatform();
      }).toThrow('Unsupported platform: freebsd');
    });

    it('should return appropriate adapter for Windows', async () => {
      mockPlatform.mockReturnValue('win32');
      
      const AdapterClass = await PlatformDetector.getPlatformAdapter();
      const adapter = new AdapterClass();
      expect(adapter).toBeDefined();
      expect(typeof adapter.findProcessByPort).toBe('function');
      expect(typeof adapter.killProcess).toBe('function');
      expect(typeof adapter.isCompatible).toBe('function');
    });

    it('should return appropriate adapter for Unix', async () => {
      mockPlatform.mockReturnValue('linux');
      
      const AdapterClass = await PlatformDetector.getPlatformAdapter();
      const adapter = new AdapterClass();
      expect(adapter).toBeDefined();
      expect(typeof adapter.findProcessByPort).toBe('function');
      expect(typeof adapter.killProcess).toBe('function');
      expect(typeof adapter.isCompatible).toBe('function');
    });
  });

});