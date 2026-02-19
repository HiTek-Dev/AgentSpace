import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';

export interface IdentityFileInfo {
  name: string;
  filename: string;
  description: string;
}

export const IDENTITY_FILES: IdentityFileInfo[] = [
  { name: 'Soul', filename: 'SOUL.md', description: 'Core personality and values' },
  { name: 'Identity', filename: 'IDENTITY.md', description: 'Background, expertise, communication style' },
  { name: 'User', filename: 'USER.md', description: 'Information about the user' },
  { name: 'Style', filename: 'STYLE.md', description: 'Tone, humor, formatting preferences' },
];

export async function getConfigDir(): Promise<string> {
  const home = await homeDir();
  return await join(home, '.config', 'tek');
}

export async function loadIdentityFile(filename: string): Promise<string | null> {
  const configDir = await getConfigDir();
  const filePath = await join(configDir, filename);

  const fileExists = await exists(filePath);
  if (!fileExists) {
    return null;
  }

  return await readTextFile(filePath);
}

export async function saveIdentityFile(filename: string, content: string): Promise<void> {
  const configDir = await getConfigDir();

  const dirExists = await exists(configDir);
  if (!dirExists) {
    await mkdir(configDir, { recursive: true });
  }

  const filePath = await join(configDir, filename);
  await writeTextFile(filePath, content);
}
