import { Process as FreePortProcess } from '../models/process';

/**
 * Base adapter interface defining common methods for platform-specific implementations
 * This serves as a contract that all platform adapters must implement
 */
export abstract class BaseAdapter {
  /**
   * Finds processes running on the specified port
   * @param port - Port number to check
   * @returns Array of process objects
   * @throws If port lookup fails
   */
  abstract findProcessByPort(port: number): Promise<FreePortProcess[]>;

  /**
   * Gets detailed information about a process by PID
   * @param pid - Process ID
   * @returns Process details object
   * @throws If process details cannot be retrieved
   */
  abstract getProcessDetails(pid: number): Promise<{
    pid: number;
    user: string;
    name: string;
    command: string;
  }>;

  /**
   * Terminates a process by PID
   * @param pid - Process ID to terminate
   * @returns True if process was successfully terminated
   * @throws If process termination fails
   */
  abstract killProcess(pid: number): Promise<boolean>;

  /**
   * Validates if the adapter can run on the current system
   * @returns True if adapter is compatible
   */
  abstract isCompatible(): Promise<boolean>;
}