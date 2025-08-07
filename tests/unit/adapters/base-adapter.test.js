const BaseAdapter = require('../../../src/adapters/base-adapter');

describe('BaseAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new BaseAdapter();
  });

  describe('interface methods', () => {
    it('should throw error when findProcessByPort is not implemented', async () => {
      await expect(adapter.findProcessByPort(3000))
        .rejects
        .toThrow('findProcessByPort method must be implemented by platform adapter');
    });

    it('should throw error when getProcessDetails is not implemented', async () => {
      await expect(adapter.getProcessDetails(1234))
        .rejects
        .toThrow('getProcessDetails method must be implemented by platform adapter');
    });

    it('should throw error when killProcess is not implemented', async () => {
      await expect(adapter.killProcess(1234))
        .rejects
        .toThrow('killProcess method must be implemented by platform adapter');
    });

    it('should throw error when isCompatible is not implemented', async () => {
      await expect(adapter.isCompatible())
        .rejects
        .toThrow('isCompatible method must be implemented by platform adapter');
    });
  });

  describe('method signatures', () => {
    it('should have findProcessByPort method', () => {
      expect(typeof adapter.findProcessByPort).toBe('function');
    });

    it('should have getProcessDetails method', () => {
      expect(typeof adapter.getProcessDetails).toBe('function');
    });

    it('should have killProcess method', () => {
      expect(typeof adapter.killProcess).toBe('function');
    });

    it('should have isCompatible method', () => {
      expect(typeof adapter.isCompatible).toBe('function');
    });
  });
});