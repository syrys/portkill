const { validatePort, validatePid, validateProtocol, validateYesNo } = require('../../../src/utils/validator');
const { ValidationError } = require('../../../src/errors');

describe('Validator', () => {
  describe('validatePort', () => {
    it('should validate valid port numbers', () => {
      expect(validatePort(1)).toBe(1);
      expect(validatePort(3000)).toBe(3000);
      expect(validatePort(65535)).toBe(65535);
      expect(validatePort('8080')).toBe(8080);
      expect(validatePort('443')).toBe(443);
    });

    it('should throw ValidationError for invalid port numbers', () => {
      expect(() => validatePort(0)).toThrow(ValidationError);
      expect(() => validatePort(-1)).toThrow(ValidationError);
      expect(() => validatePort(65536)).toThrow(ValidationError);
      expect(() => validatePort('invalid')).toThrow(ValidationError);
      expect(() => validatePort(null)).toThrow(ValidationError);
      expect(() => validatePort(undefined)).toThrow(ValidationError);
      expect(() => validatePort(3.14)).toThrow(ValidationError);
    });

    it('should throw ValidationError with correct message for out of range ports', () => {
      expect(() => validatePort(0)).toThrow('Port must be between 1 and 65535');
      expect(() => validatePort(65536)).toThrow('Port must be between 1 and 65535');
    });

    it('should throw ValidationError with correct message for non-integer ports', () => {
      expect(() => validatePort('abc')).toThrow('Port must be a valid integer');
      expect(() => validatePort(null)).toThrow('Port must be a valid integer');
    });
  });

  describe('validatePid', () => {
    it('should validate valid process IDs', () => {
      expect(validatePid(1)).toBe(1);
      expect(validatePid(1234)).toBe(1234);
      expect(validatePid('5678')).toBe(5678);
      expect(validatePid(999999)).toBe(999999);
    });

    it('should throw ValidationError for invalid process IDs', () => {
      expect(() => validatePid(0)).toThrow(ValidationError);
      expect(() => validatePid(-1)).toThrow(ValidationError);
      expect(() => validatePid('invalid')).toThrow(ValidationError);
      expect(() => validatePid(null)).toThrow(ValidationError);
      expect(() => validatePid(undefined)).toThrow(ValidationError);
      expect(() => validatePid(3.14)).toThrow(ValidationError);
    });

    it('should throw ValidationError with correct message', () => {
      expect(() => validatePid(0)).toThrow('Process ID must be a positive integer');
      expect(() => validatePid(-1)).toThrow('Process ID must be a positive integer');
      expect(() => validatePid('abc')).toThrow('Process ID must be a positive integer');
    });
  });

  describe('validateProtocol', () => {
    it('should validate valid protocols', () => {
      expect(validateProtocol('TCP')).toBe('TCP');
      expect(validateProtocol('UDP')).toBe('UDP');
      expect(validateProtocol('tcp')).toBe('TCP');
      expect(validateProtocol('udp')).toBe('UDP');
      expect(validateProtocol('Tcp')).toBe('TCP');
      expect(validateProtocol('Udp')).toBe('UDP');
    });

    it('should throw ValidationError for invalid protocols', () => {
      expect(() => validateProtocol('HTTP')).toThrow(ValidationError);
      expect(() => validateProtocol('HTTPS')).toThrow(ValidationError);
      expect(() => validateProtocol('')).toThrow(ValidationError);
      expect(() => validateProtocol(null)).toThrow(ValidationError);
      expect(() => validateProtocol(123)).toThrow(ValidationError);
    });

    it('should throw ValidationError with correct messages', () => {
      expect(() => validateProtocol(123)).toThrow('Protocol must be a string');
      expect(() => validateProtocol('HTTP')).toThrow('Protocol must be either TCP or UDP');
    });
  });

  describe('validateYesNo', () => {
    it('should return true for yes responses', () => {
      expect(validateYesNo('y')).toBe(true);
      expect(validateYesNo('Y')).toBe(true);
      expect(validateYesNo('yes')).toBe(true);
      expect(validateYesNo('YES')).toBe(true);
      expect(validateYesNo('Yes')).toBe(true);
      expect(validateYesNo(' y ')).toBe(true);
      expect(validateYesNo(' yes ')).toBe(true);
    });

    it('should return false for no responses', () => {
      expect(validateYesNo('n')).toBe(false);
      expect(validateYesNo('N')).toBe(false);
      expect(validateYesNo('no')).toBe(false);
      expect(validateYesNo('NO')).toBe(false);
      expect(validateYesNo('No')).toBe(false);
      expect(validateYesNo('')).toBe(false);
      expect(validateYesNo(' n ')).toBe(false);
      expect(validateYesNo(' no ')).toBe(false);
      expect(validateYesNo('   ')).toBe(false);
    });

    it('should return null for invalid responses', () => {
      expect(validateYesNo('maybe')).toBe(null);
      expect(validateYesNo('invalid')).toBe(null);
      expect(validateYesNo('1')).toBe(null);
      expect(validateYesNo('0')).toBe(null);
      expect(validateYesNo(123)).toBe(null);
      expect(validateYesNo(null)).toBe(null);
      expect(validateYesNo(undefined)).toBe(null);
    });
  });
});