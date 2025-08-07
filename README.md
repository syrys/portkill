# PortKill CLI

A cross-platform command-line tool for managing processes running on specific ports. Quickly identify and terminate processes to free up ports for development.

[![npm version](https://badge.fury.io/js/portkill.svg)](https://badge.fury.io/js/portkill)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)

## Features

- 🔍 **Port Detection**: Quickly identify processes running on any port
- 🎯 **Interactive Menu**: Choose which processes to kill with an intuitive menu system
- 💀 **Selective Termination**: Kill individual processes or all processes at once
- 🛡️ **Safe Operation**: Confirmation prompts prevent accidental terminations
- 🖥️ **Cross-Platform**: Works on Linux, macOS, and Windows
- 📋 **Detailed Information**: Shows PID, process name, user, protocol, and command
- 🔄 **Smart Workflow**: Automatically returns to menu after killing processes
- 🤖 **Scriptable**: Use `--yes` flag for automated scripts
- ⚡ **Fast & Lightweight**: Minimal dependencies, quick execution

### Interactive Features

- **Single Process**: Simple yes/no confirmation for single processes
- **Multiple Processes**: Interactive menu with options to:
  - Kill individual processes by selection
  - Kill all processes with confirmation
  - Cancel operation safely
- **Smart Flow**: After killing a process, automatically shows remaining processes
- **Bulk Operations**: Kill all processes at once with detailed progress
- **Error Handling**: Clear error messages with helpful suggestions
- **Cross-Platform**: Consistent experience across all operating systems

## Installation

### Global Installation (Recommended)

```bash
npm install -g portkill
```

After installation, the `pk` command will be available globally in your terminal.

### Local Installation

```bash
npm install portkill
npx pk
```

## Requirements

- Node.js 14.0.0 or higher
- Operating System: Linux, macOS, or Windows

### Platform-Specific Requirements

**Linux/macOS:**
- `lsof` command (usually pre-installed)
- `ps` command (usually pre-installed)
- `kill` command (usually pre-installed)

**Windows:**
- `netstat` command (built into Windows)
- `tasklist` command (built into Windows)
- `taskkill` command (built into Windows)

## Usage

### Interactive Mode

Simply run the command and follow the prompts:

```bash
pk
```

You'll be prompted to:
1. Enter a port number
2. View process information
3. Confirm process termination (if desired)

### Command Line Arguments

```bash
# Check a specific port
pk 3000

# Auto-kill processes without confirmation
pk 8080 --yes

# Show detailed output
pk 3000 --verbose

# Show help
pk --help

# Show version
pk --version
```

### Examples

#### Single Process - Simple Confirmation
```bash
$ pk 3000
🔍 Checking port 3000...

📋 Found 1 process using this port:

🔸 Process Details:
   PID: 12345
   Name: node
   User: developer
   Protocol: TCP
   Command: node server.js

? Do you want to kill this process (PID: 12345)? Yes

🔄 Attempting to terminate process 12345 (node)...
✅ Process 12345 has been successfully terminated
   Process: node
   Port 3000 should now be available

🎉 Process terminated successfully!
   Port 3000 should now be available
```

#### Multiple Processes - Interactive Menu
```bash
$ pk 8080
🔍 Checking port 8080...

📋 Found 3 processes using this port:

🔸 Process 1:
   PID: 12345
   Name: nginx
   User: www-data
   Protocol: TCP

🔸 Process 2:
   PID: 12346
   Name: apache2
   User: www-data
   Protocol: TCP

🔸 Process 3:
   PID: 12347
   Name: node
   User: developer
   Protocol: TCP
   Command: node app.js

============================================================
🎯 Process Management Menu
============================================================
? What would you like to do? (Use arrow keys)
❯ Kill Process 1: nginx (PID: 12345) - www-data
  Kill Process 2: apache2 (PID: 12346) - www-data
  Kill Process 3: node (PID: 12347) - developer
  ────────────────────────────────────────────────────────
  🔥 Kill ALL 3 processes
  ────────────────────────────────────────────────────────
  ❌ Cancel (do nothing)
```

#### Selecting Individual Process
```bash
# User selects "Kill Process 3: node (PID: 12347) - developer"

🔄 Attempting to terminate process 12347 (node)...
✅ Process 12347 has been successfully terminated
   Process: node
   Port 8080 should now be available

📊 2 processes still running on port 8080

============================================================
🎯 Process Management Menu
============================================================
? What would you like to do? (Use arrow keys)
❯ Kill Process 1: nginx (PID: 12345) - www-data
  Kill Process 2: apache2 (PID: 12346) - www-data
  ────────────────────────────────────────────────────────
  🔥 Kill ALL 2 processes
  ────────────────────────────────────────────────────────
  ❌ Cancel (do nothing)
```

#### Kill All Processes with Confirmation
```bash
# User selects "🔥 Kill ALL 2 processes"

⚠️  You are about to kill ALL processes:
   1. nginx (PID: 12345) - www-data
   2. apache2 (PID: 12346) - www-data

? Are you sure you want to kill all 2 processes? Yes

🔥 Killing all 2 processes...

[1/2] Killing nginx (PID: 12345)...
   ✅ Successfully killed nginx (PID: 12345)

[2/2] Killing apache2 (PID: 12346)...
   ✅ Successfully killed apache2 (PID: 12346)

==================================================
📊 Kill All Summary:
==================================================
✅ Successfully killed: 2 processes
❌ Failed to kill: 0 processes

🎉 All processes have been successfully terminated!
   Port should now be available
```

#### Canceling Operation
```bash
# User selects "❌ Cancel (do nothing)"

✋ Operation cancelled - no processes were terminated
   Port 8080 remains in use by 3 processes
```

#### Port Available
```bash
$ pk 9999
🔍 Checking port 9999...
✅ Port 9999 is available
   No processes are currently using this port
```

#### Auto-kill Mode (Skip All Prompts)
```bash
$ pk 3000 --yes
🔍 Checking port 3000...

📋 Found 2 processes using this port:

🔸 Process 1:
   PID: 12345
   Name: node
   User: developer
   Protocol: TCP

🔸 Process 2:
   PID: 12346
   Name: nginx
   User: www-data
   Protocol: TCP

⚠️  Auto-killing all processes (--yes flag used)...

🔥 Killing all 2 processes...

[1/2] Killing node (PID: 12345)...
   ✅ Successfully killed node (PID: 12345)

[2/2] Killing nginx (PID: 12346)...
   ✅ Successfully killed nginx (PID: 12346)

==================================================
📊 Kill All Summary:
==================================================
✅ Successfully killed: 2 processes
❌ Failed to kill: 0 processes

🎉 All processes have been successfully terminated!
   Port should now be available
```

#### Interactive Mode (No Port Specified)
```bash
$ pk
? Enter port number: 3000

🔍 Checking port 3000...

📋 Found 1 process using this port:

🔸 Process Details:
   PID: 12345
   Name: node
   User: developer
   Protocol: TCP
   Command: node server.js

? Do you want to kill this process (PID: 12345)? No

ℹ️  Process not terminated - port remains in use
   Process 12345 (node) is still running
```

#### Permission Error Example
```bash
$ pk 80
🔍 Checking port 80...

📋 Found 1 process using this port:

🔸 Process Details:
   PID: 1234
   Name: nginx
   User: root
   Protocol: TCP

? Do you want to kill this process (PID: 1234)? Yes

🔄 Attempting to terminate process 1234 (nginx)...
❌ Failed to terminate process 1234
   Process: nginx
   Error: Permission denied when trying to kill process 1234

💡 Permission Issue - Suggestions:
   • Use sudo: sudo pk
   • Some system processes require root privileges to terminate
```

## How It Works

### Workflow Overview

1. **Port Check**: PortKill scans the specified port for running processes
2. **Process Display**: Shows detailed information about all processes found
3. **Interactive Menu**: Presents options based on the number of processes:
   - **Single Process**: Simple yes/no confirmation
   - **Multiple Processes**: Menu with individual and bulk options
4. **Process Termination**: Attempts to kill selected processes gracefully
5. **Feedback**: Shows success/failure status with helpful suggestions
6. **Continuation**: For multiple processes, returns to menu until all are handled

### Menu Options Explained

When multiple processes are found, you'll see these options:

- **Kill Process X**: Terminates a specific process by selection
- **Kill ALL processes**: Terminates all processes after confirmation
- **Cancel**: Exits without making any changes

### Smart Behavior

- **Automatic Cleanup**: After killing a process, the menu updates to show remaining processes
- **Graceful Termination**: Attempts SIGTERM first, then SIGKILL if needed (Unix)
- **Permission Handling**: Provides clear guidance when elevated privileges are needed
- **Error Recovery**: Continues operation even if some processes can't be killed

## Command Options

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help information |
| `--version` | `-V` | Show version number |
| `--yes` | `-y` | Skip all prompts and kill all processes automatically |
| `--verbose` | `-v` | Show detailed output and enable debug logging |

## Error Handling

PortKill provides clear error messages and suggestions for common issues:

### Permission Errors
```bash
❌ Permission Error
   Insufficient privileges to terminate process

💡 Suggestions:
   • Use sudo: sudo pk
   • Make sure you have permission to terminate the process

## Quick Reference

### Common Scenarios

| Scenario | Command | What Happens |
|----------|---------|--------------|
| Check if port is free | `pk 3000` | Shows port status and any processes |
| Kill specific process | `pk 3000` → Select process from menu | Interactive menu to choose which process |
| Kill all processes | `pk 3000` → Select "Kill ALL" | Kills all processes after confirmation |
| Auto-kill everything | `pk 3000 --yes` | Immediately kills all processes without prompts |
| Interactive port entry | `pk` | Prompts for port number, then shows menu |
| Get help | `pk --help` | Shows all available options and examples |

### Typical Development Workflow

```bash
# Your development server is stuck on port 3000
$ pk 3000

# See what's running and choose what to kill
# Menu appears with options to kill specific processes or all

# After killing processes, port is free for your new server
$ npm start  # or whatever starts your development server
```
```

### System Errors
```bash
❌ System Error
   lsof command not found

💡 Suggestions:
   • Install lsof: sudo apt-get install lsof (Ubuntu/Debian) or brew install lsof (macOS)
```

### Validation Errors
```bash
❌ Validation Error
   Port 99999 is out of range. Port must be between 1 and 65535.

💡 Suggestion: Please check your input and try again.
```

## Development

### Setup

```bash
git clone <repository-url>
cd portkill
npm install
```

### Scripts

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check

# Build (lint + test)
npm run build
```

### Testing

The project includes comprehensive unit and integration tests:

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPattern=unit
npm test -- --testPathPattern=integration

# Run tests with coverage report
npm run test:coverage
```

### Project Structure

```
portkill/
├── bin/
│   └── pk                    # Global CLI executable
├── src/
│   ├── adapters/             # Platform-specific implementations
│   │   ├── base-adapter.js   # Base adapter interface
│   │   ├── unix-adapter.js   # Linux/macOS implementation
│   │   └── windows-adapter.js # Windows implementation
│   ├── core/
│   │   └── port-manager.js   # Core business logic
│   ├── errors/               # Custom error classes
│   ├── models/
│   │   └── process.js        # Process data model
│   ├── utils/                # Utility functions
│   ├── cli.js                # CLI interface
│   └── index.js              # Main entry point
├── tests/
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
└── package.json
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Guidelines

- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed
- Ensure cross-platform compatibility

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

### 1.0.0
- Initial release
- Cross-platform port management
- Interactive CLI interface
- Process termination with confirmation
- Comprehensive error handling
- Full test coverage

## Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/syrys/portkill/issues) page for existing solutions
2. Create a new issue with detailed information about your problem
3. Include your operating system, Node.js version, and error messages

## Acknowledgments

- Built with [Commander.js](https://github.com/tj/commander.js/) for CLI parsing
- Uses [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/) for interactive prompts
- Tested with [Jest](https://jestjs.io/) testing framework