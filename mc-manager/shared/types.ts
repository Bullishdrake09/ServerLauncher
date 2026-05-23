// Shared types between backend and frontend

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
}

export interface Backup {
  id: string;
  serverId: string;
  timestamp: string;
  size: number;
  path: string;
  description?: string;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface ServerLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface CreateServerRequest {
  name: string;
  port: number;
  ramMin: number;
  ramMax: number;
  type: 'vanilla' | 'paper' | 'fabric' | 'forge';
  version: string;
  autoRestart?: boolean;
}

export interface UpdateServerConfig {
  name?: string;
  ramMin?: number;
  ramMax?: number;
  autoRestart?: boolean;
  jvmFlags?: string[];
}

export interface MinecraftVersion {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  url: string;
  time: string;
  releaseTime: string;
}

export interface MinecraftVersionsResponse {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MinecraftVersion[];
}

export interface AuthToken {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  role?: 'admin' | 'user';
}

export interface WebSocketMessage {
  type: 'log' | 'status' | 'console_output' | 'error';
  serverId?: string;
  data: unknown;
}
