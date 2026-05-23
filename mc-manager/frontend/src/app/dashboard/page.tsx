'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { serversApi } from '@/lib/api';
import type { Server } from '@/lib/types';

export default function Dashboard() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuthStore();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    loadServers();
  }, [isAuthenticated]);

  const loadServers = async () => {
    try {
      const data = await serversApi.getAll();
      setServers(data);
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await serversApi.start(id);
      loadServers();
    } catch (error) {
      console.error('Failed to start server:', error);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await serversApi.stop(id);
      loadServers();
    } catch (error) {
      console.error('Failed to stop server:', error);
    }
  };

  const handleRestart = async (id: string) => {
    try {
      await serversApi.restart(id);
      loadServers();
    } catch (error) {
      console.error('Failed to restart server:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this server? This cannot be undone.')) {
      return;
    }
    try {
      await serversApi.delete(id);
      loadServers();
    } catch (error) {
      console.error('Failed to delete server:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'starting':
        return 'bg-yellow-500';
      case 'stopping':
        return 'bg-orange-500';
      case 'crashed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">MC Manager</h1>
          <div className="flex items-center gap-4">
            <Link href="/create-server" className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium transition">
              + New Server
            </Link>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-white transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">Your Servers</h2>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : servers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No servers yet</p>
            <Link href="/create-server" className="text-green-500 hover:text-green-400">
              Create your first server →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => (
              <div key={server.id} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{server.name}</h3>
                    <p className="text-sm text-gray-400">
                      {server.type} {server.version}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(server.currentStatus || server.status)} text-white`}>
                    {server.currentStatus || server.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-400 mb-4">
                  <div className="flex justify-between">
                    <span>Port:</span>
                    <span className="text-white">{server.port}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RAM:</span>
                    <span className="text-white">{server.ramMin}-{server.ramMax} MB</span>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  {server.status === 'offline' || server.status === 'crashed' ? (
                    <button
                      onClick={() => handleStart(server.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-medium transition"
                    >
                      Start
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStop(server.id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm font-medium transition"
                      >
                        Stop
                      </button>
                      <button
                        onClick={() => handleRestart(server.id)}
                        className="flex-1 bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded-lg text-sm font-medium transition"
                      >
                        Restart
                      </button>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/servers/${server.id}/console`}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-medium text-center transition"
                  >
                    Console
                  </Link>
                  <Link
                    href={`/servers/${server.id}/files`}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-medium text-center transition"
                  >
                    Files
                  </Link>
                  <Link
                    href={`/servers/${server.id}/settings`}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-medium text-center transition"
                  >
                    Settings
                  </Link>
                </div>

                <button
                  onClick={() => handleDelete(server.id)}
                  className="mt-4 w-full text-red-400 hover:text-red-300 text-sm transition"
                >
                  Delete Server
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
