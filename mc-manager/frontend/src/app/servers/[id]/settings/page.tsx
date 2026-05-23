'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { serversApi } from '@/lib/api';
import type { Server } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const params = useParams();
  const serverId = params.id as string;
  
  const { isAuthenticated } = useAuthStore();
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ramMin: 1024,
    ramMax: 2048,
    autoRestart: false,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    loadServer();
  }, [serverId, isAuthenticated]);

  const loadServer = async () => {
    try {
      const data = await serversApi.getById(serverId);
      setServer(data);
      setFormData({
        name: data.name,
        ramMin: data.ramMin,
        ramMax: data.ramMax,
        autoRestart: data.autoRestart,
      });
    } catch (error) {
      console.error('Failed to load server:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await serversApi.update(serverId, formData);
      alert('Settings saved successfully!');
      loadServer();
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this server? This cannot be undone.')) {
      return;
    }

    try {
      await serversApi.delete(serverId);
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to delete server:', error);
      alert('Failed to delete server');
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
    <div className="min-h-screen bg-gray-900">
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-bold text-white hover:text-green-500 transition">
              MC Manager
            </Link>
            <span className="text-gray-600">/</span>
            <Link href={`/servers/${serverId}`} className="text-white hover:text-green-500 transition">
              {server.name}
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">Settings</span>
          </div>
          <Link href={`/servers/${serverId}`} className="text-gray-400 hover:text-white transition text-sm">
            ← Back
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-6">Server Information</h2>
          
          <div className="space-y-4 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">Server ID</span>
              <span className="text-white font-mono">{server.id}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">Type</span>
              <span className="text-white capitalize">{server.type}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">Version</span>
              <span className="text-white">{server.version}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">Port</span>
              <span className="text-white">{server.port}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400">Path</span>
              <span className="text-white font-mono text-xs">{server.path}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">Created</span>
              <span className="text-white">{new Date(server.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-6">
          <h2 className="text-xl font-bold">Configuration</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Server Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
              required
            />
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
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-3 rounded-lg font-medium transition"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          <p className="text-xs text-gray-500">
            Note: RAM changes will take effect only after restarting the server.
          </p>
        </form>

        <div className="bg-red-900/20 rounded-xl p-6 border border-red-900/50">
          <h2 className="text-xl font-bold text-red-400 mb-4">Danger Zone</h2>
          <p className="text-gray-400 text-sm mb-4">
            Once you delete a server, there is no going back. Please be certain.
          </p>
          <button
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-medium transition"
          >
            Delete Server
          </button>
        </div>
      </main>
    </div>
  );
}
