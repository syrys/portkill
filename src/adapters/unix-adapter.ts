import { BaseAdapter } from './base-adapter';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Process as FreePortProcess } from '../models/process';
import { SystemError, PermissionError, NetworkError, ValidationError } from '../errors';

const execAsync = promisify(exec);

/**
 * Unix (Linux/macOS) platform adapter
 * Implements platform-specific commands for Unix-like systems
 */
class UnixAdapter extends BaseAdapter {
  /**
   * Finds processes running on the specified port using lsof
   * @param port - Port number to check
   * @returns Array of process objects
   */
  async findProcessByPort(port: number): Promise<FreePortProcess[]> {
    try {
      // Use lsof to find processes listening on the port
      const command = `lsof -i :${port} -P -n`;
      const { stdout } = await execAsync(command);
      
      if (!stdout.trim()) {
        return [];
      }
      
      const processes: FreePortProcess[] = [];
      const lines = stdout.trim().split('\n');
      const processMap = new Map<number, boolean>(); // Track unique PIDs to avoid duplicates
      
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse lsof output: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
        const parts = line.split(/\s+/);
        if (parts.length < 9) continue;
        
        const pid = parseInt(parts[1]);
        const user = parts[2];
        const name = parts[0];
        // Connection info might be split across multiple parts, join the remaining parts
        const connectionInfo = parts.slice(8).join(' '); // e.g., *:3000 (LISTEN) or 127.0.0.1:3000->127.0.0.1:54321 (ESTABLISHED)
        
        // Skip if not a valid PID
        if (isNaN(pid) || pid <= 0) continue;
        
        // Skip if we've already processed this PID (avoid duplicates from multiple connections)
        if (processMap.has(pid)) continue;
        
        // Determine protocol from TYPE column
        let protocol: 'TCP' | 'UDP' = 'TCP'; // Default to TCP
        if (parts[4] === 'IPv4' || parts[4] === 'IPv6') {
          protocol = 'TCP';
        } else if (parts[7] && parts[7].includes('UDP')) {
          protocol = 'UDP';
        }
        
        // Filter for relevant connections (LISTEN state or established connections)
        const isListening = connectionInfo.includes('(LISTEN)');
        const isEstablished = connectionInfo.includes('(ESTABLISHED)');
        const isRelevant = isListening || isEstablished || protocol === 'UDP';
        
        if (!isRelevant) continue;
        
        try {
          const process = new FreePortProcess({
            pid,
            name: name || 'Unknown',
            user: user || 'Unknown',
            protocol,
            port,
            command: name || 'Unknown'
          });
          processes.push(process);
          processMap.set(pid, true);
        } catch (error) {
          // Skip invalid process data but continue processing others
          continue;
        }
      }
      
      return processes;
    } catch (error: unknown) {
      const err = error as { code?: number; stderr?: string; stdout?: string; message: string };
      
      if (err.code === 1 && err.stderr && err.stderr.includes('No such file or directory')) {
        throw new SystemError('lsof command not found. Please install lsof to use this tool.', `lsof -i :${port}`, err.code);
      }
      
      if (err.code === 1 && !err.stdout) {
        // lsof returns exit code 1 when no processes are found, which is normal
        return [];
      }
      
      // Handle permission denied errors
      if (err.stderr && err.stderr.includes('Permission denied')) {
        throw new PermissionError('Permission denied when checking port. Some processes may not be visible without elevated privileges.');
      }
      
      // Check for network-related errors
      if (err.message.includes('network') || err.message.includes('connection') || 
          err.message.includes('timeout') || err.stderr && err.stderr.includes('network')) {
        throw new NetworkError(`Network error while checking port ${port}: ${err.message}`, port, 'lsof lookup');
      }
      
      // Handle invalid port errors
      if (err.stderr && err.stderr.includes('invalid')) {
        throw new ValidationError(`Invalid port number ${port} for lsof command`);
      }
      
      throw new SystemError(`Failed to find processes on port ${port}: ${err.message}`, `lsof -i :${port}`, err.code);
    }
  }

  /**
   * Gets detailed information about a process by PID using ps
   * @param pid - Process ID
   * @returns Process details object
   */
  async getProcessDetails(pid: number): Promise<{ pid: number; user: string; name: string; command: string }> {
    try {
      // Use ps to get detailed process information
      const command = `ps -p ${pid} -o pid,user,comm,args --no-headers`;
      const { stdout } = await execAsync(command);
      
      if (!stdout.trim()) {
        throw new SystemError(`Process with PID ${pid} not found`, command, 1);
      }
      
      const line = stdout.trim();
      const parts = line.split(/\s+/);
      
      if (parts.length < 4) {
        throw new SystemError(`Invalid ps output format for PID ${pid}`, command);
      }
      
      const processPid = parseInt(parts[0]);
      const user = parts[1];
      const comm = parts[2];
      const args = parts.slice(3).join(' ');
      
      return {
        pid: processPid,
        user,
        name: comm,
        command: args || comm
      };
    } catch (error: unknown) {
      if (error instanceof SystemError) {
        throw error;
      }
      
      const err = error as { code?: number; message: string };
      
      if (err.code === 1) {
        throw new SystemError(`Process with PID ${pid} not found`, `ps -p ${pid}`, err.code);
      }
      
      throw new SystemError(`Failed to get process details for PID ${pid}: ${err.message}`, `ps -p ${pid}`, err.code);
    }
  }

  /**
   * Terminates a process by PID using kill command
   * @param pid - Process ID to terminate
   * @returns True if process was successfully terminated
   */
  async killProcess(pid: number): Promise<boolean> {
    try {
      // First try graceful termination with SIGTERM
      await this._killWithSignal(pid, 'TERM');
      
      // Wait a moment to see if process terminates gracefully
      await this._sleep(1000);
      
      // Check if process is still running
      const isRunning = await this._isProcessRunning(pid);
      if (!isRunning) {
        return true;
      }
      
      // If still running, force kill with SIGKILL
      await this._killWithSignal(pid, 'KILL');
      
      // Wait a moment and check again
      await this._sleep(500);
      const isStillRunning = await this._isProcessRunning(pid);
      
      return !isStillRunning;
    } catch (error) {
      if (error instanceof PermissionError) {
        throw error;
      }
      
      const err = error as { code?: number; message: string };
      throw new SystemError(`Failed to kill process ${pid}: ${err.message}`, `kill ${pid}`, err.code);
    }
  }

  /**
   * Kills a process with a specific signal
   * @param pid - Process ID
   * @param signal - Signal name (TERM, KILL, etc.)
   * @private
   */
  private async _killWithSignal(pid: number, signal: string): Promise<void> {
    try {
      const command = `kill -${signal} ${pid}`;
      await execAsync(command);
    } catch (error: unknown) {
      const err = error as { code?: number; stderr?: string; message: string };
      
      if (err.code === 1 && err.stderr && err.stderr.includes('Operation not permitted')) {
        throw new PermissionError(`Permission denied when trying to kill process ${pid}. The process may be owned by another user or be a system process.`, pid);
      }
      
      if (err.code === 1 && err.stderr && err.stderr.includes('No such process')) {
        // Process already terminated, which is fine
        return;
      }
      
      // Provide more specific error messages
      if (err.stderr && err.stderr.includes('Invalid argument')) {
        const command = `kill -${signal} ${pid}`;
        throw new SystemError(`Invalid signal or process ID when trying to kill process ${pid}`, command, err.code);
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
      const command = `ps -p ${pid} --no-headers`;
      const { stdout } = await execAsync(command);
      return stdout.trim().length > 0;
    } catch {
      // If ps fails, assume process is not running
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
   * Validates if the adapter can run on Unix systems
   * @returns True if adapter is compatible
   */
  async isCompatible(): Promise<boolean> {
    const platform = process.platform;
    return platform === 'linux' || platform === 'darwin';
  }
}

export { UnixAdapter };