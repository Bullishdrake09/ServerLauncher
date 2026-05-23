'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { serversApi, filesApi } from '@/lib/api';
import type { Server, FileEntry } from '@/lib/types';

export default function FilesPage() {
  const router = useRouter();
  const params = useParams();
  const serverId = params.id as string;
  
  const { isAuthenticated } = useAuthStore();
  const [server, setServer] = useState<Server | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingFile, setEditingFile] = useState<{ name: string; content: string } | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    loadServer();
    loadFiles();
  }, [serverId, isAuthenticated]);

  const loadServer = async () => {
    try {
      const data = await serversApi.getById(serverId);
      setServer(data);
    } catch (error) {
      console.error('Failed to load server:', error);
    }
  };

  const loadFiles = async (path = '') => {
    try {
      const data = await filesApi.list(serverId, path);
      setFiles(data);
      setCurrentPath(path);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (file: FileEntry) => {
    if (file.type === 'directory') {
      const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
      loadFiles(newPath);
    }
  };

  const handleGoUp = () => {
    if (currentPath) {
      const parts = currentPath.split('/');
      parts.pop();
      loadFiles(parts.join('/'));
    }
  };

  const handleReadFile = async (file: FileEntry) => {
    try {
      const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
      const data = await filesApi.read(serverId, filePath);
      setEditingFile({ name: file.name, path: filePath });
      setEditContent(data.content);
    } catch (error) {
      console.error('Failed to read file:', error);
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    
    try {
      await filesApi.write(serverId, editingFile.path, editContent);
      setEditingFile(null);
      loadFiles(currentPath);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  const handleDeleteFile = async (file: FileEntry) => {
    if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;
    
    try {
      const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
      await filesApi.delete(serverId, filePath);
      loadFiles(currentPath);
    } catch (error) {
      console.error('Failed to delete file:', error);
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
            <span className="text-gray-400">Files</span>
          </div>
          <Link href={`/servers/${serverId}`} className="text-gray-400 hover:text-white transition text-sm">
            ← Back
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {editingFile ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h2 className="font-semibold">Editing: {editingFile.name}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingFile(null)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFile}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition"
                >
                  Save
                </button>
              </div>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-96 bg-gray-900 p-4 text-white font-mono text-sm focus:outline-none"
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {currentPath && (
                  <button
                    onClick={handleGoUp}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
                  >
                    ↑ Parent Directory
                  </button>
                )}
                <span className="text-gray-400 text-sm">
                  {currentPath || '/'}
                </span>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-900/50 border-b border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Name</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Type</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Size</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Modified</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => file.type === 'directory' ? handleNavigate(file) : handleReadFile(file)}
                          className="text-white hover:text-green-500 transition text-left"
                        >
                          {file.type === 'directory' ? '📁' : '📄'} {file.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-400 capitalize">{file.type}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {file.type === 'directory' ? '-' : `${(file.size / 1024).toFixed(1)} KB`}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {new Date(file.modified).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {file.type === 'file' && (
                          <button
                            onClick={() => handleDeleteFile(file)}
                            className="text-red-400 hover:text-red-300 text-sm transition"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {files.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No files in this directory
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
