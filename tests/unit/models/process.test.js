const { Process } = require('../../../src/models/process');

describe('Process Model', () => {
  const validProcessData = {
    pid: 1234,
    name: 'node',
    user: 'testuser',
    protocol: 'TCP',
    port: 3000,
    command: 'node server.js'
  };

  describe('constructor', () => {
    it('should create a valid process instance', () => {
      const process = new Process(validProcessData);
      
      expect(process.pid).toBe(1234);
      expect(process.name).toBe('node');
      expect(process.user).toBe('testuser');
      expect(process.protocol).toBe('TCP');
      expect(process.port).toBe(3000);
      expect(process.command).toBe('node server.js');
    });

    it('should create process with empty command when not provided', () => {
      const data = { ...validProcessData };
      delete data.command;
      
      const process = new Process(data);
      expect(process.command).toBe('');
    });

    it('should throw error for invalid PID', () => {
      expect(() => new Process({ ...validProcessData, pid: 'invalid' }))
        .toThrow('Process ID must be a positive integer');
      
      expect(() => new Process({ ...validProcessData, pid: -1 }))
        .toThrow('Process ID must be a positive integer');
      
      expect(() => new Process({ ...validProcessData, pid: 0 }))
        .toThrow('Process ID must be a positive integer');
    });

    it('should throw error for invalid name', () => {
      expect(() => new Process({ ...validProcessData, name: '' }))
        .toThrow('Process name must be a non-empty string');
      
      expect(() => new Process({ ...validProcessData, name: null }))
        .toThrow('Process name must be a non-empty string');
    });

    it('should throw error for invalid user', () => {
      expect(() => new Process({ ...validProcessData, user: '' }))
        .toThrow('Process user must be a non-empty string');
      
      expect(() => new Process({ ...validProcessData, user: null }))
        .toThrow('Process user must be a non-empty string');
    });

    it('should throw error for invalid protocol', () => {
      expect(() => new Process({ ...validProcessData, protocol: 'HTTP' }))
        .toThrow('Protocol must be either TCP or UDP');
      
      expect(() => new Process({ ...validProcessData, protocol: '' }))
        .toThrow('Protocol must be either TCP or UDP');
    });

    it('should throw error for invalid port', () => {
      expect(() => new Process({ ...validProcessData, port: 0 }))
        .toThrow('Port must be an integer between 1 and 65535');
      
      expect(() => new Process({ ...validProcessData, port: 65536 }))
        .toThrow('Port must be an integer between 1 and 65535');
      
      expect(() => new Process({ ...validProcessData, port: 'invalid' }))
        .toThrow('Port must be an integer between 1 and 65535');
    });

    it('should throw error for invalid command type', () => {
      expect(() => new Process({ ...validProcessData, command: 123 }))
        .toThrow('Command must be a string');
    });
  });

  describe('toObject', () => {
    it('should return plain object representation', () => {
      const process = new Process(validProcessData);
      const obj = process.toObject();
      
      expect(obj).toEqual(validProcessData);
      expect(obj).not.toBe(process); // Should be a new object
    });
  });

  describe('toJSON', () => {
    it('should return JSON string representation', () => {
      const process = new Process(validProcessData);
      const json = process.toJSON();
      
      expect(typeof json).toBe('string');
      expect(JSON.parse(json)).toEqual(validProcessData);
    });
  });

  describe('fromObject', () => {
    it('should create Process instance from plain object', () => {
      const process = Process.fromObject(validProcessData);
      
      expect(process).toBeInstanceOf(Process);
      expect(process.pid).toBe(validProcessData.pid);
      expect(process.name).toBe(validProcessData.name);
    });

    it('should throw error for invalid object data', () => {
      expect(() => Process.fromObject({ ...validProcessData, pid: 'invalid' }))
        .toThrow('Process ID must be a positive integer');
    });
  });

  describe('fromJSON', () => {
    it('should create Process instance from JSON string', () => {
      const json = JSON.stringify(validProcessData);
      const process = Process.fromJSON(json);
      
      expect(process).toBeInstanceOf(Process);
      expect(process.pid).toBe(validProcessData.pid);
      expect(process.name).toBe(validProcessData.name);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => Process.fromJSON('invalid json'))
        .toThrow();
    });

    it('should throw error for JSON with invalid data', () => {
      const invalidData = { ...validProcessData, pid: 'invalid' };
      const json = JSON.stringify(invalidData);
      
      expect(() => Process.fromJSON(json))
        .toThrow('Process ID must be a positive integer');
    });
  });
});