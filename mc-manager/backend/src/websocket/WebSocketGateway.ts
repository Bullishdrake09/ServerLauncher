import { FastifyInstance, FastifyRequest } from 'fastify';
import { ServerManagerService } from '../services/ServerManagerService';
import { WebSocket } from 'ws';

interface ClientConnection {
  ws: WebSocket;
  serverId: string | null;
  userId: string;
}

export class WebSocketGateway {
  private clients: Map<string, Set<ClientConnection>> = new Map();
  private serverManager: ServerManagerService;

  constructor(serverManager: ServerManagerService) {
    this.serverManager = serverManager;
  }

  register(fastify: FastifyInstance): void {
    fastify.register(import('@fastify/websocket'), {
      options: {
        maxPayload: 1048576, // 1MB
      },
    });

    fastify.get('/ws/console', { websocket: true }, (connection, req: FastifyRequest) => {
      const ws = connection.socket as WebSocket;
      const token = this.extractToken(req);
      
      if (!token) {
        ws.close(4001, 'Authentication required');
        return;
      }

      let userId = 'anonymous';
      try {
        const decoded = fastify.jwt.verify(token) as { id: string };
        userId = decoded.id;
      } catch {
        ws.close(4002, 'Invalid token');
        return;
      }

      const client: ClientConnection = {
        ws,
        serverId: null,
        userId
      };

      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(client, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        this.removeClient(client);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClient(client);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to MC Manager WebSocket'
      }));
    });

    // Subscribe to process events
    this.serverManager.onServerEvent('log', (serverId: string, log: { timestamp: string; level: string; message: string }) => {
      this.broadcastToServer(serverId, {
        type: 'log',
        serverId,
        data: log
      });
    });

    this.serverManager.onServerEvent('status', (serverId: string, status: string) => {
      this.broadcastToServer(serverId, {
        type: 'status',
        serverId,
        data: { status }
      });
    });

    this.serverManager.onServerEvent('error', (serverId: string, error: string) => {
      this.broadcastToServer(serverId, {
        type: 'error',
        serverId,
        data: { message: error }
      });
    });
  }

  private handleMessage(client: ClientConnection, data: { type: string; serverId?: string; command?: string }): void {
    const { ws } = client;

    switch (data.type) {
      case 'subscribe':
        if (data.serverId) {
          client.serverId = data.serverId;
          
          // Add to clients set for this server
          if (!this.clients.has(data.serverId)) {
            this.clients.set(data.serverId, new Set());
          }
          this.clients.get(data.serverId)!.add(client);

          // Send current log buffer
          const logs = this.serverManager.getLogBuffer(data.serverId);
          ws.send(JSON.stringify({
            type: 'log_buffer',
            serverId: data.serverId,
            data: logs
          }));

          // Send current status
          const status = this.serverManager.getServerStatus(data.serverId);
          ws.send(JSON.stringify({
            type: 'status',
            serverId: data.serverId,
            data: { status }
          }));

          console.log(`Client ${client.userId} subscribed to server ${data.serverId}`);
        }
        break;

      case 'unsubscribe':
        if (client.serverId) {
          this.removeClient(client);
          client.serverId = null;
        }
        break;

      case 'command':
        if (client.serverId && data.command) {
          const success = this.serverManager.sendCommand(client.serverId, data.command);
          ws.send(JSON.stringify({
            type: 'command_result',
            serverId: client.serverId,
            data: { success, command: data.command }
          }));
        }
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: `Unknown message type: ${data.type}` }
        }));
    }
  }

  private broadcastToServer(serverId: string, message: { type: string; serverId: string; data: unknown }): void {
    const serverClients = this.clients.get(serverId);
    if (!serverClients) return;

    const messageStr = JSON.stringify(message);
    for (const client of serverClients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    }
  }

  private removeClient(client: ClientConnection): void {
    if (client.serverId) {
      const serverClients = this.clients.get(client.serverId);
      if (serverClients) {
        serverClients.delete(client);
        if (serverClients.size === 0) {
          this.clients.delete(client.serverId);
        }
      }
    }
  }

  private extractToken(req: FastifyRequest): string | null {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    return token || null;
  }
}
