import { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

export interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface ServerRow {
  id: string;
  name: string;
  path: string;
  port: number;
  ramMin: number;
  ramMax: number;
  type: 'vanilla' | 'paper' | 'fabric' | 'forge';
  version: string;
  status: 'offline' | 'running' | 'starting' | 'stopping' | 'crashed';
  autoRestart: boolean;
  jvmFlags: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupRow {
  id: string;
  serverId: string;
  timestamp: string;
  size: number;
  path: string;
  description: string | null;
}

export class DatabaseService {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        port INTEGER NOT NULL,
        ramMin INTEGER NOT NULL,
        ramMax INTEGER NOT NULL,
        type TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'offline',
        autoRestart INTEGER NOT NULL DEFAULT 0,
        jvmFlags TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        serverId TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        size INTEGER NOT NULL,
        path TEXT NOT NULL,
        description TEXT,
        FOREIGN KEY (serverId) REFERENCES servers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
      CREATE INDEX IF NOT EXISTS idx_backups_serverId ON backups(serverId);
    `);

    // Create default admin user if none exists
    const adminExists = this.db.prepare('SELECT 1 FROM users WHERE role = ?').get('admin');
    if (!adminExists) {
      const defaultPassword = 'admin123';
      const passwordHash = bcrypt.hashSync(defaultPassword, 10);
      this.db.prepare(`
        INSERT INTO users (id, username, passwordHash, role, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), 'admin', passwordHash, 'admin', new Date().toISOString());
      console.log('Default admin user created: admin / admin123');
    }
  }

  // User operations
  createUser(username: string, password: string, role: 'admin' | 'user' = 'user'): UserRow {
    const id = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);
    const createdAt = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO users (id, username, passwordHash, role, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, username, passwordHash, role, createdAt);

    return { id, username, passwordHash, role, createdAt };
  }

  getUserByUsername(username: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  }

  getUserById(id: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }

  getAllUsers(): UserRow[] {
    return this.db.prepare('SELECT id, username, role, createdAt FROM users').all() as UserRow[];
  }

  deleteUser(id: string): void {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  // Server operations
  createServer(server: Omit<ServerRow, 'id' | 'createdAt' | 'updatedAt'>): ServerRow {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO servers (id, name, path, port, ramMin, ramMax, type, version, status, autoRestart, jvmFlags, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      server.name,
      server.path,
      server.port,
      server.ramMin,
      server.ramMax,
      server.type,
      server.version,
      server.status,
      server.autoRestart ? 1 : 0,
      server.jvmFlags,
      now,
      now
    );

    return { ...server, id, createdAt: now, updatedAt: now };
  }

  getServer(id: string): ServerRow | undefined {
    return this.db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as ServerRow | undefined;
  }

  getAllServers(): ServerRow[] {
    return this.db.prepare('SELECT * FROM servers ORDER BY createdAt DESC').all() as ServerRow[];
  }

  updateServer(id: string, updates: Partial<ServerRow>): ServerRow | undefined {
    const existing = this.getServer(id);
    if (!existing) return undefined;

    const allowedFields = ['name', 'ramMin', 'ramMax', 'autoRestart', 'jvmFlags', 'status', 'port'];
    const validUpdates: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        validUpdates[key] = key === 'autoRestart' ? (value ? 1 : 0) : value;
      }
    }

    if (Object.keys(validUpdates).length === 0) return existing;

    const setClause = Object.keys(validUpdates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(validUpdates), new Date().toISOString(), id];

    this.db.prepare(`
      UPDATE servers SET ${setClause}, updatedAt = ? WHERE id = ?
    `).run(...values);

    return this.getServer(id);
  }

  deleteServer(id: string): boolean {
    const result = this.db.prepare('DELETE FROM servers WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getServerByPort(port: number): ServerRow | undefined {
    return this.db.prepare('SELECT * FROM servers WHERE port = ?').get(port) as ServerRow | undefined;
  }

  // Backup operations
  createBackup(backup: Omit<BackupRow, 'id'>): BackupRow {
    const id = uuidv4();

    this.db.prepare(`
      INSERT INTO backups (id, serverId, timestamp, size, path, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, backup.serverId, backup.timestamp, backup.size, backup.path, backup.description);

    return { ...backup, id };
  }

  getBackupsByServerId(serverId: string): BackupRow[] {
    return this.db.prepare('SELECT * FROM backups WHERE serverId = ? ORDER BY timestamp DESC')
      .all(serverId) as BackupRow[];
  }

  getBackup(id: string): BackupRow | undefined {
    return this.db.prepare('SELECT * FROM backups WHERE id = ?').get(id) as BackupRow | undefined;
  }

  deleteBackup(id: string): boolean {
    const result = this.db.prepare('DELETE FROM backups WHERE id = ?').run(id);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}
