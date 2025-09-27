import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import { verify } from 'jsonwebtoken';
import type { DbStorage } from './storage';

export interface AuthenticatedWebSocket extends WebSocket {
  accessKeyId?: string;
  role?: string;
  lastHeartbeat?: number;
  subscriptions?: Set<string>;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout;
  private storage: DbStorage;

  constructor(server: Server, storage: DbStorage) {
    this.storage = storage;
    
    // Create WebSocket server
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      clientTracking: true,
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', async (ws: AuthenticatedWebSocket, request) => {
      try {
        // Extract token from query params or headers
        const url = parse(request.url || '', true);
        const token = url.query.token as string || 
                     request.headers.authorization?.replace('Bearer ', '') ||
                     request.headers['x-session-token'] as string;

        if (!token) {
          ws.close(1008, 'Authentication required');
          return;
        }

        // Validate session token
        const session = await this.storage.getUserSessionByToken(token);
        if (!session || session.expiresAt < new Date()) {
          ws.close(1008, 'Invalid or expired session');
          return;
        }

        // Update session activity
        await this.storage.updateSessionActivity(session.id);

        // Get access key details
        const accessKey = await this.storage.getAccessKey(session.accessKeyId);
        if (!accessKey) {
          ws.close(1008, 'Invalid access key');
          return;
        }

        // Set up authenticated WebSocket
        ws.accessKeyId = session.accessKeyId;
        ws.role = accessKey.role;
        ws.lastHeartbeat = Date.now();
        ws.subscriptions = new Set();

        // Add to clients map
        if (!this.clients.has(session.accessKeyId)) {
          this.clients.set(session.accessKeyId, new Set());
        }
        this.clients.get(session.accessKeyId)!.add(ws);

        console.log(`WebSocket client connected: ${session.accessKeyId} (${accessKey.role})`);

        // Set up message handlers
        this.setupMessageHandlers(ws);

        // Send connection confirmation
        this.sendToClient(ws, {
          type: 'connection_established',
          data: {
            accessKeyId: session.accessKeyId,
            role: accessKey.role,
            serverTime: new Date().toISOString()
          },
          timestamp: Date.now()
        });

      } catch (error) {
        console.error('WebSocket connection error:', error);
        ws.close(1011, 'Internal server error');
      }
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  private setupMessageHandlers(ws: AuthenticatedWebSocket) {
    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        await this.handleMessage(ws, data);
      } catch (error) {
        console.error('WebSocket message error:', error);
        this.sendToClient(ws, {
          type: 'error',
          data: { message: 'Invalid message format' },
          timestamp: Date.now()
        });
      }
    });

    ws.on('close', () => {
      this.handleClientDisconnect(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
      this.handleClientDisconnect(ws);
    });

    // Handle pong responses for heartbeat
    ws.on('pong', () => {
      ws.lastHeartbeat = Date.now();
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: any) {
    switch (message.type) {
      case 'subscribe':
        if (message.channel) {
          ws.subscriptions?.add(message.channel);
          this.sendToClient(ws, {
            type: 'subscribed',
            data: { channel: message.channel },
            timestamp: Date.now()
          });
        }
        break;

      case 'unsubscribe':
        if (message.channel) {
          ws.subscriptions?.delete(message.channel);
          this.sendToClient(ws, {
            type: 'unsubscribed',
            data: { channel: message.channel },
            timestamp: Date.now()
          });
        }
        break;

      case 'ping':
        this.sendToClient(ws, {
          type: 'pong',
          data: { timestamp: Date.now() },
          timestamp: Date.now()
        });
        break;

      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  private handleClientDisconnect(ws: AuthenticatedWebSocket) {
    if (ws.accessKeyId) {
      const clientSet = this.clients.get(ws.accessKeyId);
      if (clientSet) {
        clientSet.delete(ws);
        if (clientSet.size === 0) {
          this.clients.delete(ws.accessKeyId);
        }
      }
      console.log(`WebSocket client disconnected: ${ws.accessKeyId}`);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      this.clients.forEach((clientSet, accessKeyId) => {
        clientSet.forEach((ws) => {
          if (now - (ws.lastHeartbeat || 0) > timeout) {
            console.log(`WebSocket client timeout: ${accessKeyId}`);
            ws.terminate();
            this.handleClientDisconnect(ws);
          } else {
            // Send ping
            ws.ping();
          }
        });
      });
    }, 15000); // Check every 15 seconds
  }

  private sendToClient(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        this.handleClientDisconnect(ws);
      }
    }
  }

  // Public methods for broadcasting events

  public broadcastToUser(accessKeyId: string, message: WebSocketMessage) {
    const clientSet = this.clients.get(accessKeyId);
    if (clientSet) {
      clientSet.forEach((ws) => {
        this.sendToClient(ws, message);
      });
    }
  }

  public broadcastToChannel(channel: string, message: WebSocketMessage, excludeAccessKeyId?: string) {
    this.clients.forEach((clientSet, accessKeyId) => {
      if (excludeAccessKeyId && accessKeyId === excludeAccessKeyId) {
        return;
      }
      
      clientSet.forEach((ws) => {
        if (ws.subscriptions?.has(channel)) {
          this.sendToClient(ws, message);
        }
      });
    });
  }

  public broadcastToAll(message: WebSocketMessage, excludeAccessKeyId?: string) {
    this.clients.forEach((clientSet, accessKeyId) => {
      if (excludeAccessKeyId && accessKeyId === excludeAccessKeyId) {
        return;
      }
      
      clientSet.forEach((ws) => {
        this.sendToClient(ws, message);
      });
    });
  }

  public broadcastToAdmins(message: WebSocketMessage) {
    this.clients.forEach((clientSet) => {
      clientSet.forEach((ws) => {
        if (ws.role === 'admin') {
          this.sendToClient(ws, message);
        }
      });
    });
  }

  // Event broadcasting methods for specific data types

  public broadcastSystemMetrics(metrics: any, accessKeyId?: string) {
    const message: WebSocketMessage = {
      type: 'system_metrics_update',
      data: metrics,
      timestamp: Date.now()
    };

    if (accessKeyId) {
      this.broadcastToUser(accessKeyId, message);
    } else {
      this.broadcastToChannel('system_metrics', message);
    }
  }

  public broadcastWalletUpdate(walletData: any, accessKeyId: string) {
    const message: WebSocketMessage = {
      type: 'wallet_status_update',
      data: walletData,
      timestamp: Date.now()
    };

    this.broadcastToUser(accessKeyId, message);
  }

  public broadcastActivityUpdate(activity: any, accessKeyId?: string) {
    const message: WebSocketMessage = {
      type: 'activity_feed_update',
      data: activity,
      timestamp: Date.now()
    };

    if (accessKeyId) {
      this.broadcastToUser(accessKeyId, message);
    } else {
      this.broadcastToChannel('activities', message);
    }
  }

  public broadcastBundleAnalytics(analytics: any, accessKeyId?: string) {
    const message: WebSocketMessage = {
      type: 'bundle_analytics_update',
      data: analytics,
      timestamp: Date.now()
    };

    if (accessKeyId) {
      this.broadcastToUser(accessKeyId, message);
    } else {
      this.broadcastToChannel('bundle_analytics', message);
    }
  }

  public broadcastLaunchPlanUpdate(launchPlan: any, accessKeyId?: string) {
    const message: WebSocketMessage = {
      type: 'launch_plan_update',
      data: launchPlan,
      timestamp: Date.now()
    };

    if (accessKeyId) {
      this.broadcastToUser(accessKeyId, message);
    } else {
      this.broadcastToChannel('launch_plans', message);
    }
  }

  public broadcastBundleExecutionUpdate(bundleExecution: any, accessKeyId?: string) {
    const message: WebSocketMessage = {
      type: 'bundle_execution_update',
      data: bundleExecution,
      timestamp: Date.now()
    };

    if (accessKeyId) {
      this.broadcastToUser(accessKeyId, message);
    } else {
      this.broadcastToChannel('bundle_executions', message);
    }
  }

  public broadcastEnvironmentUpdate(environmentConfig: any) {
    const message: WebSocketMessage = {
      type: 'environment_update',
      data: environmentConfig,
      timestamp: Date.now()
    };

    this.broadcastToChannel('environment', message);
  }

  public getClientCount(): number {
    let count = 0;
    this.clients.forEach((clientSet) => {
      count += clientSet.size;
    });
    return count;
  }

  public getConnectionStatus() {
    return {
      totalClients: this.getClientCount(),
      connectedUsers: this.clients.size,
      channels: ['system_metrics', 'activities', 'bundle_analytics', 'launch_plans', 'bundle_executions', 'environment']
    };
  }

  public close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}