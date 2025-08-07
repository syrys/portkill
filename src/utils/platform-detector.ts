import * as os from 'os';

export type Platform = 'windows' | 'unix';

/**
 * Detects the current platform and returns a normalized platform identifier
 * @returns 'windows' for Windows, 'unix' for Linux/macOS
 * @throws If platform is not supported
 */
export function detectPlatform(): Platform {
  const platform = os.platform();
  
  switch (platform) {
  case 'win32':
    return 'windows';
  case 'linux':
  case 'darwin':
    return 'unix';
  default:
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Gets the appropriate platform adapter based on the current OS
 * @returns Platform-specific adapter class constructor
 * @throws If platform is not supported
 */
export async function getPlatformAdapter(): Promise<new () => import('../adapters/base-adapter').BaseAdapter> {
  const platform = detectPlatform();
  
  switch (platform) {
  case 'windows':
    return (await import('../adapters/windows-adapter')).WindowsAdapter;
  case 'unix':
    return (await import('../adapters/unix-adapter')).UnixAdapter;
  default:
    throw new Error(`No adapter available for platform: ${platform}`);
  }
}