import { Command } from 'commander';
import inquirer from 'inquirer';
import { PortManager } from './core/port-manager';
import { ValidationError, PermissionError, SystemError, NetworkError } from './errors';
import { createLogger } from './utils/logger';
import { Process as FreePortProcess } from './models/process';

interface CommandOptions {
  yes?: boolean;
  verbose?: boolean;
}

/**
 * CLI interface for PortKill
 * Handles command parsing, user interaction, and process management
 */
export class CLI {
  private readonly program: Command;
  private readonly portManager: PortManager;
  private readonly logger = createLogger('CLI');

  constructor() {
    this.program = new Command();
    this.portManager = new PortManager();
    this.setupCommands();
  }

  /**
   * Set up Commander.js commands and options
   */
  private setupCommands(): void {
    this.program
      .name('pk')
      .description('A cross-platform CLI tool for managing processes running on specific ports')
      .version(require('../package.json').version)
      .argument('[port]', 'Port number to check (1-65535)')
      .option('-y, --yes', 'Skip confirmation prompts and kill processes automatically')
      .option('-v, --verbose', 'Show detailed output and enable debug logging')
      .addHelpText('after', `
Examples:
  $ pk                         # Interactive mode - prompts for port number
  $ pk 3000                    # Check port 3000 and show interactive menu
  $ pk 8080 --yes              # Check port 8080 and auto-kill all processes
  $ pk 3000 --verbose          # Check port 3000 with detailed output

Interactive Features:
  • View all processes running on a port
  • Kill individual processes with confirmation
  • Kill all processes at once
  • Cancel operation (do nothing)
  • Automatic re-check after killing processes

Environment Variables:
  PORTKILL_LOG_LEVEL          # Set log level (ERROR, WARN, INFO, DEBUG, TRACE)
  LOG_LEVEL                   # Alternative log level variable

Common Ports:
  80    - HTTP web server
  443   - HTTPS web server
  3000  - Development server (React, Express, etc.)
  8080  - Alternative HTTP port
  5432  - PostgreSQL database
  3306  - MySQL database
  6379  - Redis cache
  27017 - MongoDB database

For more information, visit: https://github.com/your-repo/portkill`)
      .action(async (port: string | undefined, options: CommandOptions) => {
        // Handle verbose logging
        if (options.verbose) {
          process.env.PORTKILL_LOG_LEVEL = 'DEBUG';
          this.logger.info('Verbose mode enabled - debug logging active');
        }
        
        await this.handlePortCommand(port, options);
      });

    this.program
      .command('help')
      .description('Show detailed help information with examples')
      .action(() => {
        this.program.help();
      });
  }

  /**
   * Handle the main port command
   * @param port - Port number from command line
   * @param options - Command line options
   */
  private async handlePortCommand(port: string | undefined, options: CommandOptions): Promise<void> {
    try {
      // Get port number (from argument or prompt)
      const portNumber = port ? port : await this.promptForPort();
      this.logger.debug('Handling port command:', { port: portNumber, options });
      
      console.log(`🔍 Checking port ${portNumber}...`);

      // Check for processes on the port
      const processes = await this.portManager.checkPort(portNumber);

      if (processes.length === 0) {
        console.log(`✅ Port ${portNumber} is available`);
        console.log('   No processes are currently using this port');
        return;
      }

      // Display process information
      this.displayProcesses(processes);

      // Handle process termination
      if (processes.length === 1) {
        await this.handleSingleProcess(processes[0], options);
      } else {
        await this.handleMultipleProcesses(processes, options, portNumber);
      }

    } catch (error) {
      this.handleError(error as Error);
      process.exit(1);
    }
  }

  /**
   * Prompt user for port number with validation
   * @returns Valid port number
   */
  private async promptForPort(): Promise<number> {
    const questions = [
      {
        type: 'input',
        name: 'port',
        message: 'Enter port number:',
        validate: (input: string): boolean | string => {
          try {
            const port = parseInt(input, 10);
            if (isNaN(port) || port < 1 || port > 65535) {
              return 'Please enter a valid port number (1-65535)';
            }
            return true;
          } catch {
            return 'Please enter a valid port number (1-65535)';
          }
        },
        filter: (input: string): number => parseInt(input, 10)
      }
    ];

    const answers = await inquirer.prompt(questions);
    return answers.port as number;
  }

  /**
   * Display process information in a formatted way
   * @param processes - Array of process objects
   */
  private displayProcesses(processes: FreePortProcess[]): void {
    console.log('');
    console.log(`📋 Found ${processes.length} process${processes.length > 1 ? 'es' : ''} using this port:`);
    
    processes.forEach((proc, index) => {
      console.log('');
      console.log(`${processes.length > 1 ? `🔸 Process ${index + 1}:` : '🔸 Process Details:'}`);
      console.log(`   PID: ${proc.pid}`);
      console.log(`   Name: ${proc.name}`);
      console.log(`   User: ${proc.user}`);
      if (proc.protocol) {
        console.log(`   Protocol: ${proc.protocol}`);
      }
      if (proc.command && proc.command !== proc.name) {
        console.log(`   Command: ${proc.command}`);
      }
    });
    console.log('');
  }

  /**
   * Handle termination of a single process
   * @param proc - Process object
   * @param options - Command line options
   */
  private async handleSingleProcess(proc: FreePortProcess, options: CommandOptions): Promise<void> {
    const shouldKill = options.yes ?? await this.promptForKill(proc);
    
    if (shouldKill) {
      const success = await this.killProcessWithFeedback(proc);
      if (success) {
        console.log('\n🎉 Process terminated successfully!');
        console.log(`   Port ${proc.port} should now be available`);
      }
    } else {
      console.log('ℹ️  Process not terminated - port remains in use');
      console.log(`   Process ${proc.pid} (${proc.name}) is still running`);
    }
  }

  /**
   * Handle termination of multiple processes with interactive menu
   * @param processes - Array of process objects
   * @param options - Command line options
   * @param portNumber - Port number being checked
   */
  private async handleMultipleProcesses(processes: FreePortProcess[], options: CommandOptions, portNumber?: string | number): Promise<void> {
    // If --yes flag is used, kill all processes
    if (options.yes) {
      console.log('⚠️  Auto-killing all processes (--yes flag used)...');
      await this.killAllProcesses(processes);
      return;
    }

    // Interactive menu for process selection
    await this.showProcessMenu(processes, portNumber);
  }

  /**
   * Show interactive menu for process management
   * @param processes - Array of process objects
   * @param portNumber - Port number being checked
   */
  private async showProcessMenu(processes: FreePortProcess[], portNumber?: string | number): Promise<void> {
    while (processes.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('🎯 Process Management Menu');
      console.log('='.repeat(60));
      
      // Create menu choices
      const choices = [];
      
      // Add individual process options
      processes.forEach((proc, index) => {
        choices.push({
          name: `Kill Process ${index + 1}: ${proc.name} (PID: ${proc.pid}) - ${proc.user}`,
          value: `kill_${index}`,
          short: `Kill ${proc.name}`
        });
      });
      
      // Add bulk actions
      if (processes.length > 1) {
        choices.push(new inquirer.Separator());
        choices.push({
          name: `🔥 Kill ALL ${processes.length} processes`,
          value: 'kill_all',
          short: 'Kill All'
        });
      }
      
      choices.push(new inquirer.Separator());
      choices.push({
        name: '❌ Cancel (do nothing)',
        value: 'cancel',
        short: 'Cancel'
      });

      const questions = [
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: choices,
          pageSize: 15
        }
      ];

      const answers = await inquirer.prompt(questions);
      
      if (answers.action === 'cancel') {
        console.log('\n✋ Operation cancelled - no processes were terminated');
        console.log(`   Port ${portNumber || 'specified'} remains in use by ${processes.length} process${processes.length > 1 ? 'es' : ''}`);
        return;
      }
      
      if (answers.action === 'kill_all') {
        const confirmKillAll = await this.confirmKillAll(processes);
        if (confirmKillAll) {
          await this.killAllProcesses(processes);
          return;
        }
        continue; // Go back to menu if user cancels
      }
      
      // Handle individual process killing
      if (answers.action.startsWith('kill_')) {
        const processIndex = parseInt(answers.action.split('_')[1]);
        const processToKill = processes[processIndex];
        
        if (processToKill) {
          const success = await this.killProcessWithFeedback(processToKill);
          
          if (success) {
            // Remove the killed process from the array
            processes.splice(processIndex, 1);
            
            if (processes.length === 0) {
              console.log('\n🎉 All processes have been terminated!');
              console.log(`   Port ${portNumber || 'specified'} should now be available`);
              return;
            } else {
              console.log(`\n📊 ${processes.length} process${processes.length > 1 ? 'es' : ''} still running on port ${portNumber || 'specified'}`);
              // Continue the loop to show the menu again
            }
          }
          // If kill failed, continue to show menu again
        }
      }
    }
  }

  /**
   * Confirm killing all processes
   * @param processes - Array of process objects
   * @returns True if user confirms
   */
  private async confirmKillAll(processes: FreePortProcess[]): Promise<boolean> {
    console.log('\n⚠️  You are about to kill ALL processes:');
    processes.forEach((proc, index) => {
      console.log(`   ${index + 1}. ${proc.name} (PID: ${proc.pid}) - ${proc.user}`);
    });
    
    const questions = [
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to kill all ${processes.length} processes?`,
        default: false
      }
    ];

    const answers = await inquirer.prompt(questions);
    return answers.confirm as boolean;
  }

  /**
   * Kill all processes in the array
   * @param processes - Array of process objects
   */
  private async killAllProcesses(processes: FreePortProcess[]): Promise<void> {
    console.log(`\n🔥 Killing all ${processes.length} processes...`);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < processes.length; i++) {
      const proc = processes[i];
      console.log(`\n[${i + 1}/${processes.length}] Killing ${proc.name} (PID: ${proc.pid})...`);
      
      const success = await this.killProcessWithFeedback(proc, false);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Kill All Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Successfully killed: ${successCount} process${successCount !== 1 ? 'es' : ''}`);
    console.log(`❌ Failed to kill: ${failureCount} process${failureCount !== 1 ? 'es' : ''}`);
    
    if (failureCount === 0) {
      console.log('\n🎉 All processes have been successfully terminated!');
      console.log('   Port should now be available');
    } else if (successCount > 0) {
      console.log('\n⚠️  Some processes were terminated, but others may still be running');
      console.log('   You may need elevated privileges to kill the remaining processes');
    } else {
      console.log('\n❌ No processes were successfully terminated');
      console.log('   You may need elevated privileges or the processes may be protected');
    }
  }

  /**
   * Kill a process with detailed feedback
   * @param proc - Process object to kill
   * @param showDetailedOutput - Whether to show detailed output
   * @returns True if process was successfully killed
   */
  private async killProcessWithFeedback(proc: FreePortProcess, showDetailedOutput: boolean = true): Promise<boolean> {
    try {
      if (showDetailedOutput) {
        console.log(`\n🔄 Attempting to terminate process ${proc.pid} (${proc.name})...`);
      }
      
      const success = await this.portManager.killProcess(proc.pid);
      
      if (success) {
        if (showDetailedOutput) {
          console.log(`✅ Process ${proc.pid} has been successfully terminated`);
          console.log(`   Process: ${proc.name}`);
          console.log(`   Port ${proc.port} should now be available`);
        } else {
          console.log(`   ✅ Successfully killed ${proc.name} (PID: ${proc.pid})`);
        }
        return true;
      } else {
        if (showDetailedOutput) {
          console.log(`❌ Failed to terminate process ${proc.pid}`);
          console.log(`   Process: ${proc.name}`);
          console.log('');
          console.log('💡 Suggestions:');
          console.log('   • The process may have already terminated');
          console.log('   • Try running with elevated privileges');
          console.log('   • Check if the process is protected by the system');
        } else {
          console.log(`   ❌ Failed to kill ${proc.name} (PID: ${proc.pid})`);
        }
        return false;
      }
    } catch (error) {
      const err = error as Error;
      if (showDetailedOutput) {
        console.log(`❌ Failed to terminate process ${proc.pid}`);
        console.log(`   Process: ${proc.name}`);
        console.log(`   Error: ${err.message}`);
        console.log('');
        
        if (error instanceof PermissionError) {
          console.log('💡 Permission Issue - Suggestions:');
          if (process.platform === 'win32') {
            console.log('   • Run Command Prompt or PowerShell as Administrator');
            console.log('   • Some system processes cannot be terminated by users');
          } else {
            console.log('   • Use sudo: sudo pk');
            console.log('   • Some system processes require root privileges to terminate');
          }
        } else if (error instanceof SystemError) {
          console.log('💡 System Issue - Suggestions:');
          console.log('   • The process may have already terminated');
          console.log('   • Check if the process is protected or critical to the system');
          console.log('   • Verify that process termination commands are available');
        } else {
          console.log('💡 Suggestions:');
          console.log('   • Try running the command again');
          console.log('   • Check system permissions and requirements');
        }
      } else {
        console.log(`   ❌ Failed to kill ${proc.name} (PID: ${proc.pid}) - ${err.message}`);
      }
      return false;
    }
  }

  /**
   * Prompt user for process termination confirmation
   * @param process - Process object
   * @param processNumber - Process number (for multiple processes)
   * @returns True if user wants to kill the process
   */
  private async promptForKill(proc: FreePortProcess, processNumber?: number): Promise<boolean> {
    const processLabel = processNumber ? `process ${processNumber} (PID: ${proc.pid})` : `this process (PID: ${proc.pid})`;
    
    const questions = [
      {
        type: 'confirm',
        name: 'kill',
        message: `Do you want to kill ${processLabel}?`,
        default: false
      }
    ];

    const answers = await inquirer.prompt(questions);
    return answers.kill as boolean;
  }



  /**
   * Handle and display errors appropriately
   * @param error - Error to handle
   */
  private handleError(error: Error): void {
    console.error(''); // Add spacing for better readability
    
    if (error instanceof ValidationError) {
      console.error('❌ Validation Error');
      console.error(`   ${error.message}`);
      console.error('');
      console.error('💡 Suggestion: Please check your input and try again.');
    } else if (error instanceof PermissionError) {
      console.error('❌ Permission Error');
      console.error(`   ${error.message}`);
      console.error('');
      console.error('💡 Suggestions:');
      if (process.platform === 'win32') {
        console.error('   • Run Command Prompt or PowerShell as Administrator');
        console.error('   • Right-click on your terminal and select "Run as administrator"');
      } else {
        console.error('   • Use sudo: sudo pk');
        console.error('   • Make sure you have permission to terminate the process');
      }
    } else if (error instanceof NetworkError) {
      console.error('❌ Network Error');
      console.error(`   ${error.message}`);
      
      if (error.port) {
        console.error(`   Port: ${error.port}`);
      }
      if (error.operation) {
        console.error(`   Operation: ${error.operation}`);
      }
      
      console.error('');
      console.error('💡 Suggestions:');
      console.error('   • Check your network connection');
      console.error('   • Verify the port number is correct and accessible');
      console.error('   • Ensure no firewall is blocking the connection');
      console.error('   • Try again in a few moments');
      console.error('   • Check if the service on this port is responding');
    } else if (error instanceof SystemError) {
      console.error('❌ System Error');
      console.error(`   ${error.message}`);
      
      if (error.command) {
        console.error(`   Command: ${error.command}`);
      }
      if (error.exitCode !== null && error.exitCode !== undefined) {
        console.error(`   Exit code: ${error.exitCode}`);
      }
      
      console.error('');
      console.error('💡 Suggestions:');
      
      // Provide specific suggestions based on the error
      if (error.message.includes('lsof command not found')) {
        console.error('   • Install lsof: sudo apt-get install lsof (Ubuntu/Debian) or brew install lsof (macOS)');
      } else if (error.message.includes('netstat')) {
        console.error('   • Ensure netstat is available on your Windows system');
        console.error('   • Try running the command in an elevated Command Prompt');
      } else if (error.message.includes('tasklist') || error.message.includes('taskkill')) {
        console.error('   • Ensure you have permission to view/terminate processes');
        console.error('   • Try running as Administrator');
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        console.error('   • Check your network connection');
        console.error('   • Verify the port number is correct');
        console.error('   • Try again in a few moments');
      } else {
        console.error('   • Check that all required system commands are available');
        console.error('   • Verify your system permissions');
        console.error('   • Try running the command again');
      }
    } else {
      console.error('❌ Unexpected Error');
      console.error(`   ${error?.message ?? 'Unknown error occurred'}`);
      console.error('');
      console.error('💡 Suggestions:');
      console.error('   • This might be a bug - please report it if the issue persists');
      console.error('   • Try running the command again');
      console.error('   • Check that your system meets the requirements');
      
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
        console.error('');
        console.error('🔍 Debug Information:');
        console.error(error?.stack ?? 'No stack trace available');
      }
    }
    
    console.error(''); // Add spacing after error
  }

  /**
   * Parse command line arguments and execute
   * @param argv - Command line arguments
   */
  async run(argv: string[] = process.argv): Promise<void> {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      this.handleError(error as Error);
      process.exit(1);
    }
  }
}