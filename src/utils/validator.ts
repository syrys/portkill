/**
 * Validation utilities for the FreePort CLI
 */

import { ValidationError } from '../errors';

/**
 * Validate port number
 * @param port - Port value to validate
 * @returns Valid port number
 * @throws If port is invalid
 */
export function validatePort(port: unknown): number {
  // Convert to number if it's a string
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port as number;
  
  // Check if it's a valid number
  if (!Number.isInteger(portNum) || isNaN(portNum)) {
    throw new ValidationError(`Invalid port number: "${port}". Port must be a valid integer between 1 and 65535.`);
  }
  
  // Check port range (1-65535)
  if (portNum < 1 || portNum > 65535) {
    throw new ValidationError(`Port ${portNum} is out of range. Port must be between 1 and 65535. Common ports: 80 (HTTP), 443 (HTTPS), 3000 (development), 8080 (web server).`);
  }
  
  return portNum;
}

/**
 * Validate process ID
 * @param pid - Process ID to validate
 * @returns Valid process ID
 * @throws If PID is invalid
 */
export function validatePid(pid: unknown): number {
  const pidNum = typeof pid === 'string' ? parseInt(pid, 10) : pid as number;
  
  if (!Number.isInteger(pidNum) || isNaN(pidNum) || pidNum <= 0) {
    throw new ValidationError(`Invalid process ID: "${pid}". Process ID must be a positive integer (e.g., 1234).`);
  }
  
  return pidNum;
}

/**
 * Validate protocol
 * @param protocol - Protocol to validate
 * @returns Valid protocol
 * @throws If protocol is invalid
 */
export function validateProtocol(protocol: string): 'TCP' | 'UDP' {
  if (typeof protocol !== 'string') {
    throw new ValidationError('Protocol must be a string');
  }
  
  const upperProtocol = protocol.toUpperCase();
  if (!['TCP', 'UDP'].includes(upperProtocol)) {
    throw new ValidationError('Protocol must be either TCP or UDP');
  }
  
  return upperProtocol as 'TCP' | 'UDP';
}

/**
 * Validate user input for yes/no questions
 * @param input - User input to validate
 * @returns True for yes, false for no, null for invalid
 */
export function validateYesNo(input: string): boolean | null {
  if (typeof input !== 'string') {
    return null;
  }
  
  const normalized = input.toLowerCase().trim();
  
  if (['y', 'yes'].includes(normalized)) {
    return true;
  }
  
  if (['n', 'no', ''].includes(normalized)) {
    return false;
  }
  
  // Invalid input
  return null;
}