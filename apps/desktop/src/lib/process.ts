import { Command } from '@tauri-apps/plugin-shell';
import { homeDir } from '@tauri-apps/api/path';

export interface ProcessResult {
  success: boolean;
  error?: string;
}

/**
 * Get the path to the tek CLI binary.
 * Installed at ~/tek/bin/tek by the install script.
 */
async function getTekBinPath(): Promise<string> {
  const home = await homeDir();
  return `${home}tek/bin/tek`;
}

/**
 * Start the gateway via the tek CLI.
 * Tries the "tek" command (in PATH via install script), falls back to invoking
 * node with the full binary path if "tek" isn't available.
 */
export async function startGateway(): Promise<ProcessResult> {
  try {
    // Primary: invoke tek directly (~/tek/bin added to PATH by install script)
    const command = Command.create('tek', ['gateway', 'start']);
    const output = await command.execute();

    if (output.code !== 0) {
      return {
        success: false,
        error: output.stderr || `Process exited with code ${output.code}`,
      };
    }

    return { success: true };
  } catch (primaryErr) {
    // Fallback: invoke via node with full path
    try {
      const tekPath = await getTekBinPath();
      const command = Command.create('node', [tekPath, 'gateway', 'start']);
      const output = await command.execute();

      if (output.code !== 0) {
        return {
          success: false,
          error: output.stderr || `Process exited with code ${output.code}`,
        };
      }

      return { success: true };
    } catch (fallbackErr) {
      return {
        success: false,
        error: primaryErr instanceof Error ? primaryErr.message : 'Failed to start gateway',
      };
    }
  }
}

/**
 * Stop the gateway via the tek CLI.
 * Tries the "tek" command first, falls back to node with full path.
 */
export async function stopGateway(): Promise<ProcessResult> {
  try {
    const command = Command.create('tek', ['gateway', 'stop']);
    const output = await command.execute();

    if (output.code !== 0) {
      return {
        success: false,
        error: output.stderr || `Process exited with code ${output.code}`,
      };
    }

    return { success: true };
  } catch (primaryErr) {
    try {
      const tekPath = await getTekBinPath();
      const command = Command.create('node', [tekPath, 'gateway', 'stop']);
      const output = await command.execute();

      if (output.code !== 0) {
        return {
          success: false,
          error: output.stderr || `Process exited with code ${output.code}`,
        };
      }

      return { success: true };
    } catch (fallbackErr) {
      return {
        success: false,
        error: primaryErr instanceof Error ? primaryErr.message : 'Failed to stop gateway',
      };
    }
  }
}
