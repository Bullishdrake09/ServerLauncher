import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import { createWriteStream, createReadStream } from 'fs';

export class FileManagerService {
  private readonly serversRoot: string;

  constructor(serversRoot: string) {
    this.serversRoot = path.resolve(serversRoot);
  }

  /**
   * Validates that a file path is within the allowed server directory
   * Prevents path traversal attacks
   */
  private validatePath(serverId: string, relativePath: string): string {
    const serverDir = path.join(this.serversRoot, serverId);
    const resolvedServerDir = path.resolve(serverDir);
    
    // Normalize and resolve the requested path
    const normalizedRelative = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(serverDir, normalizedRelative);
    const resolvedFullPath = path.resolve(fullPath);

    // Ensure the path is within the server directory
    if (!resolvedFullPath.startsWith(resolvedServerDir)) {
      throw new Error('Access denied: Path traversal detected');
    }

    return resolvedFullPath;
  }

  /**
   * List files in a server directory
   */
  listFiles(serverId: string, subPath: string = ''): Array<{
    name: string;
    type: 'file' | 'directory';
    size: number;
    modified: string;
  }> {
    const dirPath = this.validatePath(serverId, subPath);

    if (!fs.existsSync(dirPath)) {
      throw new Error('Directory does not exist');
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map(entry => {
      const entryPath = path.join(dirPath, entry.name);
      const stats = fs.statSync(entryPath);
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString()
      };
    });
  }

  /**
   * Read file contents
   */
  readFile(serverId: string, filePath: string): string {
    const fullPath = this.validatePath(serverId, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error('File does not exist');
    }

    const stats = fs.statSync(fullPath);
    if (stats.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('File too large to read');
    }

    return fs.readFileSync(fullPath, 'utf8');
  }

  /**
   * Write file contents
   */
  writeFile(serverId: string, filePath: string, content: string): void {
    const fullPath = this.validatePath(serverId, filePath);

    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf8');
  }

  /**
   * Delete a file or empty directory
   */
  deleteFile(serverId: string, filePath: string): void {
    const fullPath = this.validatePath(serverId, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error('File does not exist');
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      fs.rmdirSync(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }

  /**
   * Create a directory
   */
  createDirectory(serverId: string, dirPath: string): void {
    const fullPath = this.validatePath(serverId, dirPath);
    fs.mkdirSync(fullPath, { recursive: true });
  }

  /**
   * Rename/move a file or directory
   */
  rename(serverId: string, oldPath: string, newPath: string): void {
    const oldFullPath = this.validatePath(serverId, oldPath);
    const newFullPath = this.validatePath(serverId, newPath);

    if (!fs.existsSync(oldFullPath)) {
      throw new Error('Source does not exist');
    }

    fs.renameSync(oldFullPath, newFullPath);
  }

  /**
   * Get file statistics
   */
  getStats(serverId: string, filePath: string): {
    size: number;
    created: string;
    modified: string;
    isDirectory: boolean;
  } {
    const fullPath = this.validatePath(serverId, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error('File does not exist');
    }

    const stats = fs.statSync(fullPath);
    return {
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      isDirectory: stats.isDirectory()
    };
  }

  /**
   * Check if file exists
   */
  exists(serverId: string, filePath: string): boolean {
    try {
      const fullPath = this.validatePath(serverId, filePath);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  /**
   * Create a backup of the world folder
   */
  async createBackup(
    serverId: string,
    backupPath: string,
    worldFolder: string = 'world'
  ): Promise<{ path: string; size: number }> {
    const worldDir = this.validatePath(serverId, worldFolder);
    
    if (!fs.existsSync(worldDir)) {
      throw new Error('World folder does not exist');
    }

    // Ensure backup directory exists
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const output = createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        const stats = fs.statSync(backupPath);
        resolve({ path: backupPath, size: stats.size });
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(worldDir, false);
      archive.finalize();
    });
  }

  /**
   * Extract a backup to restore it
   */
  async extractBackup(
    serverId: string,
    backupPath: string,
    targetFolder: string = 'world'
  ): Promise<void> {
    const targetDir = this.validatePath(serverId, targetFolder);
    
    // Validate backup path is within backups directory
    const backupsDir = path.join(this.serversRoot, '_backups');
    const resolvedBackupPath = path.resolve(backupPath);
    
    if (!resolvedBackupPath.startsWith(backupsDir)) {
      throw new Error('Invalid backup path');
    }

    if (!fs.existsSync(resolvedBackupPath)) {
      throw new Error('Backup file does not exist');
    }

    // Remove existing world folder
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    fs.mkdirSync(targetDir, { recursive: true });

    // Use native unzip on the system
    const { execSync } = await import('child_process');
    try {
      if (process.platform === 'win32') {
        // PowerShell Expand-Archive
        execSync(`powershell -Command "Expand-Archive -Path '${resolvedBackupPath}' -DestinationPath '${targetDir}' -Force"`);
      } else {
        execSync(`unzip -o '${resolvedBackupPath}' -d '${targetDir}'`);
      }
    } catch (error) {
      throw new Error('Failed to extract backup');
    }
  }

  /**
   * Get the server root path
   */
  getServerPath(serverId: string): string {
    return path.join(this.serversRoot, serverId);
  }

  /**
   * Ensure server directory exists
   */
  ensureServerDirectory(serverId: string): string {
    const serverPath = this.getServerPath(serverId);
    if (!fs.existsSync(serverPath)) {
      fs.mkdirSync(serverPath, { recursive: true });
    }
    return serverPath;
  }
}
