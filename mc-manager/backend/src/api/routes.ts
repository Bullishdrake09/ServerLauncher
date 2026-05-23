import { FastifyInstance, FastifyRequest } from 'fastify';
import { ServerManagerService } from '../services/ServerManagerService';
import { DatabaseService, UserRow } from '../database/DatabaseService';

interface JwtPayload {
  id: string;
  username: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export function registerAuthRoutes(
  fastify: FastifyInstance,
  db: DatabaseService
) {
  // Login
  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };

    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password required' });
    }

    const user = db.getUserByUsername(username);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const bcrypt = await import('bcryptjs');
    const valid = bcrypt.compareSync(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = fastify.jwt.sign({
      id: user.id,
      username: user.username,
      role: user.role
    });

    reply.send({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  });

  // Register (admin only or first user)
  fastify.post('/api/auth/register', async (request, reply) => {
    const { username, password, role } = request.body as {
      username: string;
      password: string;
      role?: 'admin' | 'user';
    };

    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password required' });
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = db.getUserByUsername(username);
    if (existingUser) {
      return reply.status(400).send({ error: 'Username already exists' });
    }

    // Check if this is the first user (allow any role) or require admin
    const users = db.getAllUsers();
    if (users.length > 0 && request.user?.role !== 'admin') {
      return reply.status(403).send({ error: 'Only admins can create new users' });
    }

    const newUser = db.createUser(username, password, role || 'user');

    const token = fastify.jwt.sign({
      id: newUser.id,
      username: newUser.username,
      role: newUser.role
    });

    reply.status(201).send({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role
      }
    });
  });

  // Get current user
  fastify.get('/api/auth/me', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const user = db.getUserById(request.user.id);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    reply.send({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt
    });
  });
}

export function registerServerRoutes(
  fastify: FastifyInstance,
  serverManager: ServerManagerService
) {
  // Get all servers
  fastify.get('/api/servers', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const servers = serverManager.getAllServers();
    reply.send(servers);
  });

  // Create server
  fastify.post('/api/servers', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { name, port, ramMin, ramMax, type, version, autoRestart } = request.body as {
      name: string;
      port: number;
      ramMin: number;
      ramMax: number;
      type: 'vanilla' | 'paper' | 'fabric' | 'forge';
      version: string;
      autoRestart?: boolean;
    };

    if (!name || !port || !ramMin || !ramMax || !type || !version) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      const server = await serverManager.createServer({
        name,
        port,
        ramMin,
        ramMax,
        type,
        version,
        autoRestart
      });
      reply.status(201).send(server);
    } catch (error) {
      console.error('Failed to create server:', error);
      reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to create server' });
    }
  });

  // Get single server
  fastify.get('/api/servers/:id', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = serverManager.getServer(id);
    
    if (!server) {
      return reply.status(404).send({ error: 'Server not found' });
    }

    reply.send(server);
  });

  // Update server
  fastify.patch('/api/servers/:id', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as {
      name?: string;
      ramMin?: number;
      ramMax?: number;
      autoRestart?: boolean;
      jvmFlags?: string;
    };

    const server = serverManager.updateServer(id, updates);
    if (!server) {
      return reply.status(404).send({ error: 'Server not found' });
    }

    reply.send(server);
  });

  // Delete server
  fastify.delete('/api/servers/:id', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const result = await serverManager.deleteServer(id);
      if (!result) {
        return reply.status(404).send({ error: 'Server not found' });
      }
      reply.send({ success: true });
    } catch (error) {
      console.error('Failed to delete server:', error);
      reply.status(500).send({ error: 'Failed to delete server' });
    }
  });

  // Start server
  fastify.post('/api/servers/:id/start', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const result = await serverManager.startServer(id);
      reply.send({ success: result, status: serverManager.getServerStatus(id) });
    } catch (error) {
      console.error('Failed to start server:', error);
      reply.status(500).send({ error: 'Failed to start server' });
    }
  });

  // Stop server
  fastify.post('/api/servers/:id/stop', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const result = await serverManager.stopServer(id);
      reply.send({ success: result, status: serverManager.getServerStatus(id) });
    } catch (error) {
      console.error('Failed to stop server:', error);
      reply.status(500).send({ error: 'Failed to stop server' });
    }
  });

  // Restart server
  fastify.post('/api/servers/:id/restart', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const result = await serverManager.restartServer(id);
      reply.send({ success: result, status: serverManager.getServerStatus(id) });
    } catch (error) {
      console.error('Failed to restart server:', error);
      reply.status(500).send({ error: 'Failed to restart server' });
    }
  });

  // Send command
  fastify.post('/api/servers/:id/command', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { command } = request.body as { command: string };

    if (!command) {
      return reply.status(400).send({ error: 'Command required' });
    }

    try {
      const result = serverManager.sendCommand(id, command);
      reply.send({ success: result });
    } catch (error) {
      console.error('Failed to send command:', error);
      reply.status(500).send({ error: 'Failed to send command' });
    }
  });

  // Get server logs
  fastify.get('/api/servers/:id/logs', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const logs = serverManager.getLogBuffer(id);
    reply.send(logs);
  });

  // Get available Minecraft versions
  fastify.get('/api/versions', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { type } = request.query as { type?: 'release' | 'snapshot' };
    
    try {
      const versions = await serverManager.getAvailableVersions(type);
      reply.send(versions);
    } catch (error) {
      console.error('Failed to fetch versions:', error);
      reply.status(500).send({ error: 'Failed to fetch versions' });
    }
  });
}

export function registerFileRoutes(
  fastify: FastifyInstance,
  serverManager: ServerManagerService
) {
  // List files
  fastify.get('/api/servers/:id/files', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { path: filePath } = request.query as { path?: string };

    try {
      const fileManager = serverManager.getFileManager();
      const files = fileManager.listFiles(id, filePath || '');
      reply.send(files);
    } catch (error) {
      console.error('Failed to list files:', error);
      reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to list files' });
    }
  });

  // Read file
  fastify.get('/api/servers/:id/files/read', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { path: filePath } = request.query as { path: string };

    if (!filePath) {
      return reply.status(400).send({ error: 'Path required' });
    }

    try {
      const fileManager = serverManager.getFileManager();
      const content = fileManager.readFile(id, filePath);
      reply.send({ content });
    } catch (error) {
      console.error('Failed to read file:', error);
      reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to read file' });
    }
  });

  // Write file
  fastify.post('/api/servers/:id/files/write', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { path: filePath, content } = request.body as { path: string; content: string };

    if (!filePath || content === undefined) {
      return reply.status(400).send({ error: 'Path and content required' });
    }

    try {
      const fileManager = serverManager.getFileManager();
      fileManager.writeFile(id, filePath, content);
      reply.send({ success: true });
    } catch (error) {
      console.error('Failed to write file:', error);
      reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to write file' });
    }
  });

  // Delete file
  fastify.delete('/api/servers/:id/files', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { path: filePath } = request.query as { path: string };

    if (!filePath) {
      return reply.status(400).send({ error: 'Path required' });
    }

    try {
      const fileManager = serverManager.getFileManager();
      fileManager.deleteFile(id, filePath);
      reply.send({ success: true });
    } catch (error) {
      console.error('Failed to delete file:', error);
      reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to delete file' });
    }
  });

  // Create directory
  fastify.post('/api/servers/:id/files/directory', {
    preHandler: [authenticate(fastify)]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { path: dirPath } = request.body as { path: string };

    if (!dirPath) {
      return reply.status(400).send({ error: 'Path required' });
    }

    try {
      const fileManager = serverManager.getFileManager();
      fileManager.createDirectory(id, dirPath);
      reply.send({ success: true });
    } catch (error) {
      console.error('Failed to create directory:', error);
      reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to create directory' });
    }
  });
}

function authenticate(fastify: FastifyInstance) {
  return async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      throw fastify.httpErrors.unauthorized('Invalid or expired token');
    }
  };
}
