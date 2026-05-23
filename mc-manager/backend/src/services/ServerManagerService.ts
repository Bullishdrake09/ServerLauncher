import { ProcessManager } from './ProcessManager';
import { FileManagerService } from './FileManagerService';
import { VersionService } from './VersionService';
import { DatabaseService, ServerRow } from '../database/DatabaseService';
import * as path from 'path';

export class ServerManagerService {
  private readonly db: DatabaseService;
  private readonly processManager: ProcessManager;
  private readonly fileManager: FileManagerService;
  private readonly versionService: VersionService;
  private readonly serversRoot: string;

  constructor(
    db: DatabaseService,
    serversRoot: string
  ) {
    this.db = db;
    this.serversRoot = path.resolve(serversRoot);
    this.processManager = new ProcessManager();
    this.fileManager = new FileManagerService(this.serversRoot);
    this.versionService = new VersionService();

    // Ensure servers root exists
    if (!this.fileManager.exists('', '..')) {
      try {
        require('fs').mkdirSync(this.serversRoot, { recursive: true });
      } catch {
        // Already exists
      }
    }
  }

  /**
   * Create a new server
   */
  async createServer(config: {
    name: string;
    port: number;
    ramMin: number;
    ramMax: number;
    type: 'vanilla' | 'paper' | 'fabric' | 'forge';
    version: string;
    autoRestart?: boolean;
  }): Promise<ServerRow> {
    // Check if port is already in use
    const existingPort = this.db.getServerByPort(config.port);
    if (existingPort) {
      throw new Error(`Port ${config.port} is already in use by server "${existingPort.name}"`);
    }

    // Create server directory
    const serverId = require('crypto').randomUUID();
    const serverPath = this.fileManager.ensureServerDirectory(serverId);

    // Download server jar
    const jarPath = path.join(serverPath, 'server.jar');
    console.log(`Downloading server jar for ${config.type} ${config.version}...`);
    
    try {
      await this.versionService.downloadServerJar(
        config.version,
        config.type,
        jarPath
      );
    } catch (error) {
      // Clean up on failure
      try {
        require('fs').rmSync(serverPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }

    // Create database record
    const server = this.db.createServer({
      name: config.name,
      path: serverPath,
      port: config.port,
      ramMin: config.ramMin,
      ramMax: config.ramMax,
      type: config.type,
      version: config.version,
      status: 'offline',
      autoRestart: config.autoRestart ?? false,
      jvmFlags: ''
    });

    // Create process handler
    this.processManager.createProcess(server);

    console.log(`Server "${config.name}" created with ID ${serverId}`);
    return server;
  }

  /**
   * Delete a server
   */
  async deleteServer(serverId: string): Promise<boolean> {
    const server = this.db.getServer(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    // Stop server if running
    const process = this.processManager.getProcess(serverId);
    if (process && process.getStatus() !== 'offline') {
      await process.stop();
    }

    this.processManager.removeProcess(serverId);

    // Delete server files
    const serverPath = this.fileManager.getServerPath(serverId);
    try {
      require('fs').rmSync(serverPath, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to delete server files:`, error);
    }

    // Delete from database
    return this.db.deleteServer(serverId);
  }

  /**
   * Start a server
   */
  async startServer(serverId: string): Promise<boolean> {
    const server = this.db.getServer(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    let process = this.processManager.getProcess(serverId);
    if (!process) {
      process = this.processManager.createProcess(server);
    }

    return process.start();
  }

  /**
   * Stop a server
   */
  async stopServer(serverId: string, timeout?: number): Promise<boolean> {
    const server = this.db.getServer(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    const process = this.processManager.getProcess(serverId);
    if (!process) {
      return false;
    }

    const result = await process.stop(timeout);
    
    // Update database status
    this.db.updateServer(serverId, { status: 'offline' });
    
    return result;
  }

  /**
   * Restart a server
   */
  async restartServer(serverId: string): Promise<boolean> {
    const server = this.db.getServer(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    const process = this.processManager.getProcess(serverId);
    if (!process) {
      return this.startServer(serverId);
    }

    return process.restart();
  }

  /**
   * Kill a server immediately
   */
  killServer(serverId: string): boolean {
    const server = this.db.getServer(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    const process = this.processManager.getProcess(serverId);
    if (!process) {
      return false;
    }

    const result = process.kill();
    this.db.updateServer(serverId, { status: 'offline' });
    return result;
  }

  /**
   * Send a command to a running server
   */
  sendCommand(serverId: string, command: string): boolean {
    const process = this.processManager.getProcess(serverId);
    if (!process) {
      throw new Error('Server process not found');
    }

    return process.sendCommand(command);
  }

  /**
   * Get server status
   */
  getServerStatus(serverId: string): string {
    const process = this.processManager.getProcess(serverId);
    if (!process) {
      const server = this.db.getServer(serverId);
      return server?.status || 'offline';
    }

    return process.getStatus();
  }

  /**
   * Get all servers with their current status
   */
  getAllServers(): Array<ServerRow & { currentStatus: string }> {
    const servers = this.db.getAllServers();
    return servers.map(server => ({
      ...server,
      currentStatus: this.getServerStatus(server.id),
      autoRestart: !!server.autoRestart
    }));
  }

  /**
   * Get a single server
   */
  getServer(serverId: string): ServerRow & { currentStatus: string } | null {
    const server = this.db.getServer(serverId);
    if (!server) return null;

    return {
      ...server,
      currentStatus: this.getServerStatus(serverId),
      autoRestart: !!server.autoRestart
    };
  }

  /**
   * Update server configuration
   */
  updateServer(serverId: string, updates: {
    name?: string;
    ramMin?: number;
    ramMax?: number;
    autoRestart?: boolean;
    jvmFlags?: string;
  }): ServerRow | undefined {
    const server = this.db.updateServer(serverId, updates);
    
    if (server && this.processManager.getProcess(serverId)) {
      // Update process JVM flags if changed
      // Note: This would require restarting the server to take effect
    }

    return server;
  }

  /**
   * Get available Minecraft versions
   */
  async getAvailableVersions(type?: 'release' | 'snapshot') {
    return this.versionService.getAvailableVersions(type);
  }

  /**
   * Get log buffer for a server
   */
  getLogBuffer(serverId: string) {
    const process = this.processManager.getProcess(serverId);
    if (!process) return [];
    return process.getLogBuffer();
  }

  /**
   * Subscribe to server events
   */
  onServerEvent(event: string, callback: (...args: unknown[]) => void) {
    this.processManager.on(event, callback);
  }

  /**
   * Remove event listener
   */
  offServerEvent(event: string, callback: (...args: unknown[]) => void) {
    this.processManager.off(event, callback);
  }

  /**
   * Gracefully shutdown all servers
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down all servers...');
    await this.processManager.shutdownAll();
  }

  /**
   * Get file manager instance
   */
  getFileManager(): FileManagerService {
    return this.fileManager;
  }

  /**
   * Get process manager instance
   */
  getProcessManager(): ProcessManager {
    return this.processManager;
  }
}
