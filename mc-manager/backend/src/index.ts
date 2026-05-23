import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { join } from 'path';
import { DatabaseService } from './database/DatabaseService';
import { ServerManagerService } from './services/ServerManagerService';
import { WebSocketGateway } from './websocket/WebSocketGateway';
import { registerAuthRoutes, registerServerRoutes, registerFileRoutes } from './api/routes';

async function main() {
  const PORT = process.env.PORT || 3001;
  const HOST = process.env.HOST || '0.0.0.0';
  
  // Paths
  const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');
  const serversDir = process.env.SERVERS_DIR || join(dataDir, 'servers');
  const dbPath = process.env.DB_PATH || join(dataDir, 'mc-manager.db');

  console.log('MC Manager Backend Starting...');
  console.log(`Data directory: ${dataDir}`);
  console.log(`Servers directory: ${serversDir}`);
  console.log(`Database path: ${dbPath}`);

  // Ensure directories exist
  const fs = await import('fs');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(serversDir, { recursive: true });

  // Initialize database
  const db = new DatabaseService(dbPath);

  // Initialize services
  const serverManager = new ServerManagerService(db, serversDir);

  // Create Fastify instance
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info'
    }
  });

  // Register plugins
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    sign: {
      expiresIn: '7d'
    }
  });

  // Register WebSocket gateway
  const wsGateway = new WebSocketGateway(serverManager);
  wsGateway.register(fastify);

  // Register API routes
  registerAuthRoutes(fastify, db);
  registerServerRoutes(fastify, serverManager);
  registerFileRoutes(fastify, serverManager);

  // Health check endpoint
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Error handling
  fastify.setErrorHandler((error, request, reply) => {
    console.error('Unhandled error:', error);
    reply.status(error.statusCode || 500).send({
      error: error.message || 'Internal server error'
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    
    try {
      await serverManager.shutdown();
      await fastify.close();
      db.close();
      console.log('Shutdown complete.');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start server
  try {
    await fastify.listen({ port: Number(PORT), host: HOST });
    console.log(`\n✅ MC Manager Backend running at http://${HOST}:${PORT}`);
    console.log(`📝 API documentation available at http://${HOST}:${PORT}/api/health`);
    console.log(`🔌 WebSocket endpoint at ws://${HOST}:${PORT}/ws/console`);
    console.log(`\nDefault admin credentials: admin / admin123`);
    console.log('⚠️  Change the default password immediately!\n');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(console.error);
