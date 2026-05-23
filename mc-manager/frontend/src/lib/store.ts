import { create } from 'zustand';
import type { Server, User } from './types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  restore: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  
  login: (token, user) => {
    localStorage.setItem('token', token);
    set({ token, user, isAuthenticated: true });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, isAuthenticated: false });
  },
  
  restore: () => {
    const token = localStorage.getItem('token');
    if (token) {
      set({ token, isAuthenticated: true });
    }
  },
}));

interface WebSocketState {
  ws: WebSocket | null;
  isConnected: boolean;
  logs: Array<{ timestamp: string; level: string; message: string }>;
  status: string | null;
  connect: (serverId: string) => void;
  disconnect: () => void;
  sendCommand: (command: string) => void;
  clearLogs: () => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  ws: null,
  isConnected: false,
  logs: [],
  status: null,
  
  connect: (serverId: string) => {
    const { ws: existingWs } = get();
    if (existingWs) {
      existingWs.close();
    }

    const token = localStorage.getItem('token');
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const ws = new WebSocket(`${wsUrl}/ws/console?token=${token}`);

    ws.onopen = () => {
      set({ isConnected: true });
      ws.send(JSON.stringify({ type: 'subscribe', serverId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data.toString());
      
      switch (data.type) {
        case 'log':
        case 'log_buffer':
          if (Array.isArray(data.data)) {
            set((state) => ({ logs: [...state.logs, ...data.data] }));
          } else {
            set((state) => ({ logs: [...state.logs, data.data] }));
          }
          break;
        case 'status':
          set({ status: data.data.status });
          break;
      }
    };

    ws.onclose = () => {
      set({ isConnected: false, ws: null });
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      set({ isConnected: false });
    };

    set({ ws });
  },
  
  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.send(JSON.stringify({ type: 'unsubscribe' }));
      ws.close();
      set({ ws: null, isConnected: false });
    }
  },
  
  sendCommand: (command: string) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'command', command }));
    }
  },
  
  clearLogs: () => {
    set({ logs: [] });
  },
}));
