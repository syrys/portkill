import { getPlatformAdapter } from '../utils/platform-detector';
import { validatePort, validatePid } from '../utils/validator';
import { SystemError, ValidationError, PermissionError, NetworkError } from '../errors';
import { createLogger } from '../utils/logger';
import { Process as FreePortProcess } from '../models/process';
import { BaseAdapter } from '../adapters/base-adapter';

/**
 * Port Manager core business logic
 * Coordinates platform adapters to provide cross-platform port management functionality
 */
export class PortManager {
  private adapter: BaseAdapter | null = null;
  private _initialized = false;
  private readonly logger = createLogger('PortManager');

  /**
   * Initialize the port manager with the appropriate platform adapter
   * @throws If platform adapter cannot be initialized
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      this.logger.debug('Port manager already initialized');
      return;
    }

    try {
      this.logger.debug('Initializing port manager');
      const AdapterClass = await getPlatformAdapter() as new () => BaseAdapter;
      this.adapter = new AdapterClass();
      this.logger.debug('Platform adapter obtained:', { platform: process.platform });
      
      // Verify adapter compatibility
      const isCompatible = await this.adapter.isCompatible();
      if (!isCompatible) {
        this.logger.error('Platform adapter is not compatible with current system');
        throw new SystemError('Platform adapter is not compatible with current system');
      }
      
      this._initialized = true;
      this.logger.info('Port manager initialized successfully');
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error('Failed to initialize port manager:', err.message);
      if (error instanceof SystemError) {
        throw error;
      }
      throw new SystemError(`Failed to initialize port manager: ${err.message}`);
    }
  }

  /**
   * Check processes running on the specified port with detailed information
   * @param port - Port number to check
   * @returns Array of Process objects running on the port
   * @throws If port number is invalid or port lookup fails
   */
  async checkPort(port: number | string): Promise<FreePortProcess[]> {
    // Validate port number
    const validPort = validatePort(port);
    this.logger.debug('Checking port:', { port: validPort });
    
    // Ensure adapter is initialized
    await this.initialize();
    
    if (!this.adapter) {
      throw new SystemError('Port manager adapter not initialized');
    }
    
    try {
      const processes = await this.adapter.findProcessByPort(validPort);
      this.logger.debug('Port check completed:', { port: validPort, processCount: processes.length });
      return processes;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error('Port check failed:', { port: validPort, error: err.message });
      
      if (error instanceof SystemError || error instanceof ValidationError || 
          error instanceof PermissionError || error instanceof NetworkError) {
        throw error;
      }
      
      // Check if this looks like a network-related error
      if (err.message.includes('network') || err.message.includes('connection') || 
          err.message.includes('timeout') || err.message.includes('unreachable')) {
        throw new NetworkError(`Network error while checking port ${validPort}: ${err.message}`, validPort, 'port check');
      }
      
      throw new SystemError(`Failed to check port ${validPort}: ${err.message}`);
    }
  }

  /**
   * Kill a process by PID with error handling
   * @param pid - Process ID to terminate
   * @returns True if process was successfully terminated
   * @throws If PID is invalid, insufficient permissions, or process termination fails
   */
  async killProcess(pid: number | string): Promise<boolean> {
    // Validate PID
    const validPid = validatePid(pid);
    this.logger.debug('Attempting to kill process:', { pid: validPid });
    
    // Ensure adapter is initialized
    await this.initialize();
    
    if (!this.adapter) {
      throw new SystemError('Port manager adapter not initialized');
    }
    
    try {
      const success = await this.adapter.killProcess(validPid);
      this.logger.info('Process kill attempt completed:', { pid: validPid, success });
      return success;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error('Process kill failed:', { pid: validPid, error: err.message });
      
      if (error instanceof SystemError || error instanceof ValidationError || 
          error instanceof PermissionError || error instanceof NetworkError) {
        throw error;
      }
      throw new SystemError(`Failed to kill process ${validPid}: ${err.message}`);
    }
  }

  /**
   * Get detailed information about a process by PID
   * @param pid - Process ID
   * @returns Process details object
   * @throws If PID is invalid or process details cannot be retrieved
   */
  async getProcessDetails(pid: number | string): Promise<{ pid: number; user: string; name: string; command: string }> {
    // Validate PID
    const validPid = validatePid(pid);
    
    // Ensure adapter is initialized
    await this.initialize();
    
    if (!this.adapter) {
      throw new SystemError('Port manager adapter not initialized');
    }
    
    try {
      const details = await this.adapter.getProcessDetails(validPid);
      return details;
    } catch (error: unknown) {
      const err = error as Error;
      if (error instanceof SystemError || error instanceof ValidationError || 
          error instanceof PermissionError || error instanceof NetworkError) {
        throw error;
      }
      throw new SystemError(`Failed to get process details for PID ${validPid}: ${err.message}`);
    }
  }

  /**
   * Check if a specific port is available (no processes running on it)
   * @param port - Port number to check
   * @returns True if port is available, false if occupied
   * @throws If port number is invalid or port lookup fails
   */
  async isPortAvailable(port: number | string): Promise<boolean> {
    const processes = await this.checkPort(port);
    return processes.length === 0;
  }

  /**
   * Get the current platform adapter instance
   * @returns Platform adapter instance or null if not initialized
   */
  getAdapter(): BaseAdapter | null {
    return this.adapter;
  }

  /**
   * Check if the port manager is initialized
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this._initialized;
  }
}