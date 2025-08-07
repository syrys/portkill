#!/usr/bin/env node

import { CLI } from './cli';

/**
 * Main entry point for the FreePort CLI
 * Creates and runs the CLI interface with proper error handling
 */
async function main(): Promise<void> {
  const cli = new CLI();
  await cli.run();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});