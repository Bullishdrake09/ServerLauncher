import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { ServerRow } from '../database/DatabaseService';

export type ProcessStatus = 'offline' | 'running' | 'starting' | 'stopping' | 'crashed';

interface ProcessInfo {
  process: ChildProcess | null;
  status: ProcessStatus;
  restartCount: number;
  lastCrashTime: number | null;
}

export class MinecraftProcess extends EventEmitter {
  private process: ChildProcess | null = null;
  private status: ProcessStatus = 'offline';
  private restartCount = 0;
  private lastCrashTime: number | null = null;
  private readonly serverId: string;
  private readonly serverPath: string;
  private readonly port: number;
  private readonly ramMin: number;
  private readonly ramMax: number;
  private readonly serverType: string;
  private readonly version: string;
  private readonly jvmFlags: string[];
  private readonly autoRestart: boolean;
  private logBuffer: Array<{ timestamp: string; level: string; message: string }> = [];
  private readonly MAX_LOG_BUFFER = 1000;

  constructor(server: ServerRow) {
    super();
    this.serverId = server.id;
    this.serverPath = server.path;
    this.port = server.port;
    this.ramMin = server.ramMin;
    this.ramMax = server.ramMax;
    this.serverType = server.type;
    this.version = server.version;
    this.autoRestart = server.autoRestart;
    this.jvmFlags = server.jvmFlags ? server.jvmFlags.split(' ') : [];
  }

  getStatus(): ProcessStatus {
    return this.status;
  }

  getLogBuffer(): Array<{ timestamp: string; level: string; message: string }> {
    return [...this.logBuffer];
  }

  async start(): Promise<boolean> {
    if (this.status === 'running' || this.status === 'starting') {
      return false;
    }

    this.setStatus('starting');
    console.log(`[Server ${this.serverId}] Starting...`);

    try {
      // Ensure eula.txt exists and is accepted
      const eulaPath = path.join(this.serverPath, 'eula.txt');
      if (!fs.existsSync(eulaPath)) {
        fs.writeFileSync(eulaPath, 'eula=true\n', 'utf8');
      } else {
        let content = fs.readFileSync(eulaPath, 'utf8');
        if (!content.includes('eula=true')) {
          content = content.replace(/eula=false/gi, 'eula=true');
          fs.writeFileSync(eulaPath, content, 'utf8');
        }
      }

      // Find server jar
      const serverJar = this.findServerJar();
      if (!serverJar) {
        throw new Error('Server JAR not found. Please install the server first.');
      }

      // Build Java command
      const javaPath = await this.findJavaPath();
      const args = [
        ...this.jvmFlags.filter(f => f.trim() !== ''),
        `-Xms${this.ramMin}M`,
        `-Xmx${this.ramMax}M`,
        '-jar',
        serverJar,
        '--nogui'
      ];

      console.log(`[Server ${this.serverId}] Running: ${javaPath} ${args.join(' ')}`);

      this.process = spawn(javaPath, args, {
        cwd: this.serverPath,
        env: { ...process.env },
        shell: true
      });

      this.setupProcessHandlers();
      return true;
    } catch (error) {
      console.error(`[Server ${this.serverId}] Start failed:`, error);
      this.setStatus('crashed');
      this.emit('error', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private findServerJar(): string | null {
    const possibleJars = [
      'server.jar',
      'paper.jar',
      'fabric-server-launch.jar',
      'forge-installer.jar',
      'run.jar'
    ];

    for (const jar of possibleJars) {
      const jarPath = path.join(this.serverPath, jar);
      if (fs.existsSync(jarPath)) {
        return jarPath;
      }
    }

    // Check for forge installed jar
    const forgePattern = /forge-.*\.jar$/;
    try {
      const files = fs.readdirSync(this.serverPath);
      for (const file of files) {
        if (forgePattern.test(file)) {
          return path.join(this.serverPath, file);
        }
      }
    } catch {
      // Ignore
    }

    return null;
  }

  private async findJavaPath(): Promise<string> {
    // Check JAVA_HOME first
    const javaHome = process.env.JAVA_HOME;
    if (javaHome) {
      const javaExe = path.join(javaHome, 'bin', 'java.exe');
      const javaUnix = path.join(javaHome, 'bin', 'java');
      if (fs.existsSync(javaExe)) return javaExe;
      if (fs.existsSync(javaUnix)) return javaUnix;
    }

    // Try to find java in PATH
    const { execSync } = await import('child_process');
    try {
      if (process.platform === 'win32') {
        const result = execSync('where java', { encoding: 'utf8' });
        const paths = result.trim().split('\r\n');
        if (paths.length > 0) return paths[0].trim();
      } else {
        const result = execSync('which java', { encoding: 'utf8' });
        return result.trim();
      }
    } catch {
      // Java not in PATH
    }

    // Default to 'java' and let the OS handle it
    return 'java';
  }

  private setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          this.handleLogLine(line, 'info');
        }
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          this.handleLogLine(line, 'error');
        }
      }
    });

    this.process.on('close', (code: number | null) => {
      console.log(`[Server ${this.serverId}] Process exited with code ${code}`);
      this.process = null;

      if (this.status === 'stopping') {
        this.setStatus('offline');
      } else {
        this.setStatus('crashed');
        this.lastCrashTime = Date.now();
        
        // Auto-restart logic
        if (this.autoRestart && this.restartCount < 5) {
          const timeSinceLastCrash = this.lastCrashTime - (this.lastCrashTime || 0);
          if (timeSinceLastCrash > 60000 || this.lastCrashTime === null) {
            this.restartCount++;
            console.log(`[Server ${this.serverId}] Auto-restarting (${this.restartCount}/5)...`);
            setTimeout(() => this.start(), 5000);
          }
        }
      }
    });

    this.process.on('error', (error: Error) => {
      console.error(`[Server ${this.serverId}] Process error:`, error);
      this.emit('error', error.message);
    });
  }

  private handleLogLine(line: string, defaultLevel: string): void {
    const timestamp = new Date().toISOString();
    
    // Parse log level from Minecraft log format
    let level = defaultLevel;
    if (line.includes('[ERROR]') || line.includes('ERROR')) level = 'error';
    else if (line.includes('[WARN]') || line.includes('WARN')) level = 'warn';
    else if (line.includes('[DEBUG]') || line.includes('DEBUG')) level = 'debug';
    else if (line.includes('[INFO]') || line.includes('INFO')) level = 'info';

    const logEntry = { timestamp, level, message: line };
    
    // Add to buffer
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.MAX_LOG_BUFFER) {
      this.logBuffer.shift();
    }

    // Emit to listeners
    this.emit('log', logEntry);
  }

  stop(timeout: number = 30): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.process || this.status === 'offline') {
        resolve(false);
        return;
      }

      console.log(`[Server ${this.serverId}] Stopping...`);
      this.setStatus('stopping');

      // Send stop command gracefully
      this.sendCommand('stop');

      // Force kill after timeout
      const forceKillTimeout = setTimeout(() => {
        if (this.process) {
          console.log(`[Server ${this.serverId}] Force killing...`);
          this.process.kill('SIGKILL');
        }
      }, timeout * 1000);

      const checkInterval = setInterval(() => {
        if (!this.process || this.status === 'offline') {
          clearInterval(checkInterval);
          clearTimeout(forceKillTimeout);
          resolve(true);
        }
      }, 500);

      // Safety timeout
      setTimeout(() => {
        clearInterval(checkInterval);
        clearTimeout(forceKillTimeout);
        if (this.process) {
          this.process.kill('SIGKILL');
        }
        resolve(true);
      }, (timeout + 10) * 1000);
    });
  }

  async restart(): Promise<boolean> {
    await this.stop();
    this.restartCount = 0;
    this.lastCrashTime = null;
    return this.start();
  }

  kill(): boolean {
    if (!this.process) return false;

    console.log(`[Server ${this.serverId}] Killing...`);
    this.process.kill('SIGKILL');
    this.process = null;
    this.setStatus('offline');
    return true;
  }

  sendCommand(command: string): boolean {
    if (!this.process || this.status !== 'running') {
      return false;
    }

    this.process.stdin?.write(`${command}\n`);
    return true;
  }

  private setStatus(status: ProcessStatus): void {
    this.status = status;
    this.emit('status', status);
  }

  updateStatus(newStatus: ProcessStatus): void {
    this.setStatus(newStatus);
  }
}

export class ProcessManager extends EventEmitter {
  private processes: Map<string, MinecraftProcess> = new Map();

  createProcess(server: ServerRow): MinecraftProcess {
    const existing = this.processes.get(server.id);
    if (existing) {
      return existing;
    }

    const process = new MinecraftProcess(server);
    
    // Forward events
    process.on('log', (log) => this.emit('log', server.id, log));
    process.on('status', (status) => this.emit('status', server.id, status));
    process.on('error', (error) => this.emit('error', server.id, error));

    this.processes.set(server.id, process);
    return process;
  }

  getProcess(serverId: string): MinecraftProcess | undefined {
    return this.processes.get(serverId);
  }

  getAllProcesses(): Map<string, MinecraftProcess> {
    return this.processes;
  }

  async startServer(serverId: string): Promise<boolean> {
    const process = this.processes.get(serverId);
    if (!process) return false;
    return process.start();
  }

  async stopServer(serverId: string, timeout?: number): Promise<boolean> {
    const process = this.processes.get(serverId);
    if (!process) return false;
    return process.stop(timeout);
  }

  async restartServer(serverId: string): Promise<boolean> {
    const process = this.processes.get(serverId);
    if (!process) return false;
    return process.restart();
  }

  killServer(serverId: string): boolean {
    const process = this.processes.get(serverId);
    if (!process) return false;
    return process.kill();
  }

  sendCommand(serverId: string, command: string): boolean {
    const process = this.processes.get(serverId);
    if (!process) return false;
    return process.sendCommand(command);
  }

  getServerStatus(serverId: string): ProcessStatus {
    const process = this.processes.get(serverId);
    return process?.getStatus() ?? 'offline';
  }

  removeProcess(serverId: string): void {
    const process = this.processes.get(serverId);
    if (process) {
      process.removeAllListeners();
    }
    this.processes.delete(serverId);
  }

  async shutdownAll(): Promise<void> {
    const promises: Promise<unknown>[] = [];
    for (const [id, process] of this.processes) {
      console.log(`Shutting down server ${id}...`);
      promises.push(process.stop(30));
    }
    await Promise.all(promises);
    this.processes.clear();
  }
}
