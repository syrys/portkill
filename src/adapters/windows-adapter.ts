import { BaseAdapter } from './base-adapter';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Process as FreePortProcess } from '../models/process';
import { SystemError, PermissionError, NetworkError, ValidationError } from '../errors';

const execAsync = promisify(exec);

/**
 * Windows platform adapter
 * Implements platform-specific commands for Windows systems
 */
class WindowsAdapter extends BaseAdapter {
  /**
   * Finds processes running on the specified port using netstat
   * @param port - Port number to check
   * @returns Array of process objects
   */
  async findProcessByPort(port: number): Promise<FreePortProcess[]> {
    try {
      // Use netstat to find processes listening on the port
      const command = `netstat -ano | findstr :${port}`;
      const { stdout } = await execAsync(command);
      
      if (!stdout.trim()) {
        return [];
      }
      
      const processes: FreePortProcess[] = [];
      const lines = stdout.trim().split('\n');
      const pidSet = new Set<number>(); // Track unique PIDs to avoid duplicates
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // Parse netstat output: Proto Local Address Foreign Address [State] PID
        // Note: UDP doesn't have a State column
        const parts = trimmedLine.split(/\s+/);
        if (parts.length < 4) continue;
        
        const protocol = parts[0].toUpperCase() as 'TCP' | 'UDP'; // TCP or UDP
        const localAddress = parts[1];
        
        // Check if this line is for our port (more precise matching)
        const portPattern = new RegExp(`:${port}(\\s|$)`);
        const portMatch = portPattern.test(localAddress);
        if (!portMatch) continue;
        
        let pid: number;
        let state: string | null = null;
        
        if (protocol === 'TCP') {
          // TCP format: Proto Local Foreign State PID
          if (parts.length < 5) continue;
          state = parts[3];
          pid = parseInt(parts[4]);
          
          // For TCP, we're interested in LISTENING state primarily, but also ESTABLISHED
          if (state !== 'LISTENING' && state !== 'ESTABLISHED') continue;
        } else if (protocol === 'UDP') {
          // UDP format: Proto Local Foreign PID (no State column)
          if (parts.length < 4) continue;
          pid = parseInt(parts[3]);
        } else {
          continue; // Skip unknown protocols
        }
        
        // Skip if not a valid PID or if we've already processed this PID
        if (isNaN(pid) || pid <= 0 || pidSet.has(pid)) continue;
        
        pidSet.add(pid);
        
        try {
          // Get additional process details
          const processDetails = await this.getProcessDetails(pid);
          
          const process = new FreePortProcess({
            pid,
            name: processDetails.name || 'Unknown',
            user: processDetails.user || 'Unknown',
            protocol,
            port,
            command: processDetails.command || processDetails.name || 'Unknown'
          });
          processes.push(process);
        } catch {
          // If we can't get process details, create a basic process object
          try {
            const process = new FreePortProcess({
              pid,
              name: 'Unknown',
              user: 'Unknown',
              protocol,
              port,
              command: 'Unknown'
            });
            processes.push(process);
          } catch {
            // Skip invalid process data but continue processing others
            continue;
          }
        }
      }
      
      return processes;
    } catch (error: unknown) {
      const err = error as { code?: number; stderr?: string; stdout?: string; message: string };
      
      if (err.code === 1 && !err.stdout) {
        // netstat/findstr returns exit code 1 when no matches found, which is normal
        return [];
      }
      
      // Handle permission denied errors
      if (err.stderr && err.stderr.includes('Access is denied')) {
        throw new PermissionError('Permission denied when checking port. Some processes may not be visible without elevated privileges.');
      }
      
      // Check for network-related errors
      if (err.message.includes('network') || err.message.includes('connection') || 
          err.message.includes('timeout') || err.stderr && err.stderr.includes('network')) {
        throw new NetworkError(`Network error while checking port ${port}: ${err.message}`, port, 'netstat lookup');
      }
      
      // Check for missing commands
      if (err.stderr && (err.stderr.includes('not recognized') || err.stderr.includes('not found'))) {
        throw new SystemError('Required system command not found. Ensure netstat and findstr are available.', `netstat -ano | findstr :${port}`, err.code);
      }
      
      // Handle invalid port errors
      if (err.stderr && err.stderr.includes('invalid')) {
        throw new ValidationError(`Invalid port number ${port} for netstat command`);
      }
      
      throw new SystemError(`Failed to find processes on port ${port}: ${err.message}`, `netstat -ano | findstr :${port}`, err.code);
    }
  }

  /**
   * Gets detailed information about a process by PID using tasklist
   * @param pid - Process ID
   * @returns Process details object
   */
  async getProcessDetails(pid: number): Promise<{ pid: number; user: string; name: string; command: string }> {
    try {
      // Use tasklist to get detailed process information
      const command = `tasklist /FI "PID eq ${pid}" /FO CSV /NH`;
      const { stdout } = await execAsync(command);
      
      if (!stdout.trim()) {
        throw new SystemError(`Process with PID ${pid} not found`, command, 1);
      }
      
      // Parse CSV output: "Image Name","PID","Session Name","Session#","Mem Usage"
      const line = stdout.trim();
      
      // Remove quotes and split by comma
      const csvMatch = line.match(/"([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)"/);
      
      if (!csvMatch || csvMatch.length < 6) {
        throw new SystemError(`Invalid tasklist output format for PID ${pid}`, command);
      }
      
      const imageName = csvMatch[1];
      const processPid = parseInt(csvMatch[2]);
      const sessionName = csvMatch[3];
      
      // For Windows, we don't have easy access to the user without additional commands
      // We'll use the session name as a proxy, or 'System' for system processes
      const user = sessionName === 'Services' ? 'SYSTEM' : sessionName;
      
      return {
        pid: processPid,
        user,
        name: imageName,
        command: imageName
      };
    } catch (error: unknown) {
      if (error instanceof SystemError) {
        throw error;
      }
      
      const err = error as { code?: number; message: string };
      
      if (err.code === 1) {
        throw new SystemError(`Process with PID ${pid} not found`, `tasklist /FI "PID eq ${pid}"`, err.code);
      }
      
      throw new SystemError(`Failed to get process details for PID ${pid}: ${err.message}`, `tasklist /FI "PID eq ${pid}"`, err.code);
    }
  }

  /**
   * Terminates a process by PID using taskkill command
   * @param pid - Process ID to terminate
   * @returns True if process was successfully terminated
   */
  async killProcess(pid: number): Promise<boolean> {
    try {
      // First try graceful termination
      await this._killWithForce(pid, false);
      
      // Wait a moment to see if process terminates gracefully
      await this._sleep(1000);
      
      // Check if process is still running
      const isRunning = await this._isProcessRunning(pid);
      if (!isRunning) {
        return true;
      }
      
      // If still running, force kill
      await this._killWithForce(pid, true);
      
      // Wait a moment and check again
      await this._sleep(500);
      const isStillRunning = await this._isProcessRunning(pid);
      
      return !isStillRunning;
    } catch (error) {
      if (error instanceof PermissionError) {
        throw error;
      }
      
      const err = error as { code?: number; message: string };
      throw new SystemError(`Failed to kill process ${pid}: ${err.message}`, `taskkill /PID ${pid}`, err.code);
    }
  }

  /**
   * Kills a process with or without force
   * @param pid - Process ID
   * @param force - Whether to use force (/F flag)
   * @private
   */
  private async _killWithForce(pid: number, force: boolean): Promise<void> {
    try {
      const command = force ? `taskkill /PID ${pid} /F` : `taskkill /PID ${pid}`;
      await execAsync(command);
    } catch (error: unknown) {
      const err = error as { code?: number; stderr?: string; message: string };
      
      if (err.code === 128 && err.stderr && err.stderr.includes('Access is denied')) {
        throw new PermissionError(`Permission denied when trying to kill process ${pid}. The process may be a system process or owned by another user.`, pid);
      }
      
      if (err.code === 128 && err.stderr && err.stderr.includes('not found')) {
        // Process already terminated, which is fine
        return;
      }
      
      // Check for missing taskkill command
      if (err.stderr && (err.stderr.includes('not recognized') || err.stderr.includes('not found'))) {
        const command = force ? `taskkill /PID ${pid} /F` : `taskkill /PID ${pid}`;
        throw new SystemError('taskkill command not found. Ensure Windows system tools are available.', command, err.code);
      }
      
      // Provide more specific error messages
      if (err.stderr && err.stderr.includes('Invalid argument')) {
        const command = force ? `taskkill /PID ${pid} /F` : `taskkill /PID ${pid}`;
        throw new SystemError(`Invalid process ID ${pid} or taskkill parameters`, command, err.code);
      }
      
      throw error;
    }
  }

  /**
   * Checks if a process is still running
   * @param pid - Process ID
   * @returns True if process is running
   * @private
   */
  private async _isProcessRunning(pid: number): Promise<boolean> {
    try {
      const command = `tasklist /FI "PID eq ${pid}" /FO CSV /NH`;
      const { stdout } = await execAsync(command);
      return stdout.trim().length > 0 && !stdout.includes('INFO: No tasks are running');
    } catch {
      // If tasklist fails, assume process is not running
      return false;
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after the specified time
   * @private
   */
  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validates if the adapter can run on Windows systems
   * @returns True if adapter is compatible
   */
  async isCompatible(): Promise<boolean> {
    const platform = process.platform;
    return platform === 'win32';
  }
}

export { WindowsAdapter };