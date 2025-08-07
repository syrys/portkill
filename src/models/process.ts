/**
 * Process data model representing a system process running on a port
 */

export interface ProcessOptions {
  pid: number;
  name: string;
  user: string;
  protocol: 'TCP' | 'UDP';
  port: number;
  command?: string;
}

export class Process {
  public readonly pid: number;
  public readonly name: string;
  public readonly user: string;
  public readonly protocol: 'TCP' | 'UDP';
  public readonly port: number;
  public readonly command: string;

  /**
   * Create a Process instance
   * @param options - Process options
   */
  constructor({ pid, name, user, protocol, port, command = '' }: ProcessOptions) {
    this.pid = pid;
    this.name = name;
    this.user = user;
    this.protocol = protocol;
    this.port = port;
    this.command = command;
    
    // Validate the process data
    this._validate();
  }

  /**
   * Validate process data
   * @private
   */
  private _validate(): void {
    if (!Number.isInteger(this.pid) || this.pid <= 0) {
      throw new Error('Process ID must be a positive integer');
    }
    
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Process name must be a non-empty string');
    }
    
    if (!this.user || typeof this.user !== 'string') {
      throw new Error('Process user must be a non-empty string');
    }
    
    if (!['TCP', 'UDP'].includes(this.protocol)) {
      throw new Error('Protocol must be either TCP or UDP');
    }
    
    if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535) {
      throw new Error('Port must be an integer between 1 and 65535');
    }
    
    if (typeof this.command !== 'string') {
      throw new Error('Command must be a string');
    }
  }

  /**
   * Convert process to plain object
   * @returns Plain object representation
   */
  toObject(): ProcessOptions {
    return {
      pid: this.pid,
      name: this.name,
      user: this.user,
      protocol: this.protocol,
      port: this.port,
      command: this.command
    };
  }

  /**
   * Convert process to JSON string
   * @returns JSON representation
   */
  toJSON(): string {
    return JSON.stringify(this.toObject());
  }

  /**
   * Create Process instance from plain object
   * @param obj - Plain object with process data
   * @returns Process instance
   */
  static fromObject(obj: ProcessOptions): Process {
    return new Process(obj);
  }

  /**
   * Create Process instance from JSON string
   * @param json - JSON string with process data
   * @returns Process instance
   */
  static fromJSON(json: string): Process {
    return Process.fromObject(JSON.parse(json) as ProcessOptions);
  }
}