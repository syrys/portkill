// Mock the os module
const mockPlatform = jest.fn();
jest.mock('os', () => ({
  platform: mockPlatform
}));

const { detectPlatform, getPlatformAdapter } = require('../../../src/utils/platform-detector');

describe('Platform Detector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectPlatform', () => {
    it('should return "windows" for win32 platform', () => {
      mockPlatform.mockReturnValue('win32');
      
      const result = detectPlatform();
      
      expect(result).toBe('windows');
    });

    it('should return "unix" for linux platform', () => {
      mockPlatform.mockReturnValue('linux');
      
      const result = detectPlatform();
      
      expect(result).toBe('unix');
    });

    it('should return "unix" for darwin platform', () => {
      mockPlatform.mockReturnValue('darwin');
      
      const result = detectPlatform();
      
      expect(result).toBe('unix');
    });

    it('should throw error for unsupported platform', () => {
      mockPlatform.mockReturnValue('freebsd');
      
      expect(() => {
        detectPlatform();
      }).toThrow('Unsupported platform: freebsd');
    });
  });

  describe('getPlatformAdapter', () => {
    it('should return windows adapter for win32 platform', async () => {
      mockPlatform.mockReturnValue('win32');
      
      const adapter = await getPlatformAdapter();
      
      expect(adapter).toBeDefined();
      expect(adapter.name).toBe('WindowsAdapter');
    });

    it('should return unix adapter for linux platform', async () => {
      mockPlatform.mockReturnValue('linux');
      
      const adapter = await getPlatformAdapter();
      
      expect(adapter).toBeDefined();
      expect(adapter.name).toBe('UnixAdapter');
    });

    it('should return unix adapter for darwin platform', async () => {
      mockPlatform.mockReturnValue('darwin');
      
      const adapter = await getPlatformAdapter();
      
      expect(adapter).toBeDefined();
      expect(adapter.name).toBe('UnixAdapter');
    });

    it('should throw error for unsupported platform', async () => {
      mockPlatform.mockReturnValue('freebsd');
      
      await expect(getPlatformAdapter()).rejects.toThrow('Unsupported platform: freebsd');
    });
  });
});