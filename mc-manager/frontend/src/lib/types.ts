export interface Server {
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
  createdAt: string;
  updatedAt: string;
  currentStatus?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface MinecraftVersion {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  url: string;
  time: string;
  releaseTime: string;
}
