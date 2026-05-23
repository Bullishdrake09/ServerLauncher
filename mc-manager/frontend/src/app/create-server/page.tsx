'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { serversApi, versionsApi } from '@/lib/api';
import type { MinecraftVersion } from '@/lib/types';

export default function CreateServerPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [versions, setVersions] = useState<MinecraftVersion[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    port: 25565,
    ramMin: 1024,
    ramMax: 2048,
    type: 'vanilla' as 'vanilla' | 'paper' | 'fabric' | 'forge',
    version: '',
    autoRestart: true,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    loadVersions();
  }, [isAuthenticated]);

  const loadVersions = async () => {
    try {
      const data = await versionsApi.getAvailable('release');
      setVersions(data.slice(0, 50)); // Limit to 50 latest
      if (data.length > 0 && !formData.version) {
        setFormData(prev => ({ ...prev, version: data[0].id }));
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await serversApi.create(formData);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-xl font-bold text-white hover:text-green-500 transition">
            MC Manager
          </Link>
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Create New Server</h1>

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Server Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
              placeholder="My Awesome Server"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Port
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 25565 }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
                min="1024"
                max="65535"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Server Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as typeof formData.type }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
              >
                <option value="vanilla">Vanilla</option>
                <option value="paper">Paper</option>
                <option value="fabric">Fabric</option>
                <option value="forge">Forge</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Minecraft Version
            </label>
            <select
              value={formData.version}
              onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>{v.id}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Min RAM (MB)
              </label>
              <input
                type="number"
                value={formData.ramMin}
                onChange={(e) => setFormData(prev => ({ ...prev, ramMin: parseInt(e.target.value) || 512 }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
                min="256"
                step="256"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Max RAM (MB)
              </label>
              <input
                type="number"
                value={formData.ramMax}
                onChange={(e) => setFormData(prev => ({ ...prev, ramMax: parseInt(e.target.value) || 1024 }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
                min="512"
                step="256"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoRestart"
              checked={formData.autoRestart}
              onChange={(e) => setFormData(prev => ({ ...prev, autoRestart: e.target.checked }))}
              className="rounded border-gray-700 bg-gray-900 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="autoRestart" className="text-sm text-gray-300">
              Auto-restart on crash
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-3 rounded-lg font-medium transition"
          >
            {loading ? 'Creating Server...' : 'Create Server'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            The server JAR will be downloaded automatically. This may take a few minutes depending on your internet connection.
          </p>
        </form>
      </main>
    </div>
  );
}
