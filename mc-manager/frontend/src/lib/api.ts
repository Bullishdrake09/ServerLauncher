import axios from 'axios';
import type { Server, LogEntry, FileEntry, User, MinecraftVersion } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    return response.data;
  },
  
  register: async (username: string, password: string, role?: 'admin' | 'user') => {
    const response = await api.post('/api/auth/register', { username, password, role });
    return response.data;
  },
  
  getMe: async () => {
    const response = await api.get('/api/auth/me');
    return response.data as User;
  },
};

export const serversApi = {
  getAll: async () => {
    const response = await api.get('/api/servers');
    return response.data as Server[];
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/api/servers/${id}`);
    return response.data as Server;
  },
  
  create: async (data: {
    name: string;
    port: number;
    ramMin: number;
    ramMax: number;
    type: 'vanilla' | 'paper' | 'fabric' | 'forge';
    version: string;
    autoRestart?: boolean;
  }) => {
    const response = await api.post('/api/servers', data);
    return response.data as Server;
  },
  
  update: async (id: string, data: Partial<Server>) => {
    const response = await api.patch(`/api/servers/${id}`, data);
    return response.data as Server;
  },
  
  delete: async (id: string) => {
    await api.delete(`/api/servers/${id}`);
  },
  
  start: async (id: string) => {
    const response = await api.post(`/api/servers/${id}/start`);
    return response.data;
  },
  
  stop: async (id: string) => {
    const response = await api.post(`/api/servers/${id}/stop`);
    return response.data;
  },
  
  restart: async (id: string) => {
    const response = await api.post(`/api/servers/${id}/restart`);
    return response.data;
  },
  
  sendCommand: async (id: string, command: string) => {
    const response = await api.post(`/api/servers/${id}/command`, { command });
    return response.data;
  },
  
  getLogs: async (id: string) => {
    const response = await api.get(`/api/servers/${id}/logs`);
    return response.data as LogEntry[];
  },
};

export const filesApi = {
  list: async (serverId: string, path?: string) => {
    const params = path ? { path } : {};
    const response = await api.get(`/api/servers/${serverId}/files`, { params });
    return response.data as FileEntry[];
  },
  
  read: async (serverId: string, path: string) => {
    const response = await api.get(`/api/servers/${serverId}/files/read`, {
      params: { path },
    });
    return response.data;
  },
  
  write: async (serverId: string, path: string, content: string) => {
    const response = await api.post(`/api/servers/${serverId}/files/write`, {
      path,
      content,
    });
    return response.data;
  },
  
  delete: async (serverId: string, path: string) => {
    await api.delete(`/api/servers/${serverId}/files`, {
      params: { path },
    });
  },
  
  createDirectory: async (serverId: string, path: string) => {
    const response = await api.post(`/api/servers/${serverId}/files/directory`, {
      path,
    });
    return response.data;
  },
};

export const versionsApi = {
  getAvailable: async (type?: 'release' | 'snapshot') => {
    const params = type ? { type } : {};
    const response = await api.get('/api/versions', { params });
    return response.data as MinecraftVersion[];
  },
};

export default api;
