'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore, useWebSocketStore } from '@/lib/store';
import { serversApi } from '@/lib/api';
import type { Server } from '@/lib/types';

export default function ConsolePage() {
  const router = useRouter();
  const params = useParams();
  const serverId = params.id as string;
  
  const { isAuthenticated } = useAuthStore();
  const { logs, status, isConnected, connect, disconnect, sendCommand, clearLogs } = useWebSocketStore();
  
  const [server, setServer] = useState<Server | null>(null);
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    loadServer();
    connect(serverId);

    return () => {
      disconnect();
    };
  }, [serverId, isAuthenticated]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const loadServer = async () => {
    try {
      const data = await serversApi.getById(serverId);
      setServer(data);
    } catch (error) {
      console.error('Failed to load server:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      sendCommand(command.trim());
      setCommand('');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'text-green-500';
      case 'starting':
        return 'text-yellow-500';
      case 'stopping':
        return 'text-orange-500';
      case 'crashed':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getLogLevelClass = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'debug':
        return 'text-gray-500';
      default:
        return 'text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400">Server not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-bold text-white hover:text-green-500 transition">
              MC Manager
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-white">{server.name}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              status === 'running' ? 'bg-green-500/20 text-green-500' : 
              status === 'offline' ? 'bg-gray-500/20 text-gray-500' :
              'bg-yellow-500/20 text-yellow-500'
            }`}>
              {status || server.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
              {isConnected ? '● Connected' : '○ Disconnected'}
            </span>
            <Link href={`/servers/${serverId}`} className="text-gray-400 hover:text-white transition text-sm">
              ← Back
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 gap-4">
        {/* Console Output */}
        <div className="flex-1 bg-black rounded-xl border border-gray-800 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
            <span className="text-sm text-gray-400">Server Console</span>
            <button
              onClick={clearLogs}
              className="text-xs text-gray-500 hover:text-white transition"
            >
              Clear
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-600">No logs yet. Start the server to see output.</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`${getLogLevelClass(log.level)} break-all`}>
                  <span className="text-gray-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                  {log.message}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Command Input */}
        <form onSubmit={handleSendCommand} className="flex gap-2">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Type a command... (e.g., /op, /gamemode, stop)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 font-mono"
            disabled={!isConnected || status !== 'running'}
          />
          <button
            type="submit"
            disabled={!isConnected || status !== 'running' || !command.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition"
          >
            Send
          </button>
        </form>

        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => sendCommand('stop')}
            disabled={status !== 'running'}
            className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            /stop
          </button>
          <button
            onClick={() => sendCommand('op YourName')}
            disabled={status !== 'running'}
            className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/50 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            /op &lt;name&gt;
          </button>
          <button
            onClick={() => sendCommand('gamemode creative')}
            disabled={status !== 'running'}
            className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/50 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Creative Mode
          </button>
          <button
            onClick={() => sendCommand('whitelist add YourName')}
            disabled={status !== 'running'}
            className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-600/50 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Whitelist
          </button>
        </div>
      </main>
    </div>
  );
}
