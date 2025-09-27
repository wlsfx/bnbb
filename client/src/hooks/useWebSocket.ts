import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealTimeUpdates } from './use-real-time';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface WebSocketConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastConnected: Date | null;
  reconnectAttempts: number;
}

export interface UseWebSocketOptions {
  enabled?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  fallbackToPolling?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    enabled = true,
    reconnectInterval = 1000,
    maxReconnectAttempts = 10,
    onConnect,
    onDisconnect,
    onError,
    onMessage,
    fallbackToPolling = true,
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<WebSocketConnectionStatus>({
    connected: false,
    connecting: false,
    error: null,
    lastConnected: null,
    reconnectAttempts: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const messageHandlersRef = useRef<Map<string, (data: any) => void>>(new Map());

  // Get WebSocket URL and token
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = localStorage.getItem('sessionToken') || 
                  sessionStorage.getItem('sessionToken') ||
                  document.cookie.split('; ').find(row => row.startsWith('sessionToken='))?.split('=')[1];
    
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    return `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;
  }, []);

  // Clear reconnection timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // Handle built-in message types
      switch (message.type) {
        case 'connection_established':
          console.log('WebSocket connection established:', message.data);
          setConnectionStatus(prev => ({
            ...prev,
            connected: true,
            connecting: false,
            error: null,
            lastConnected: new Date(),
            reconnectAttempts: 0,
          }));
          break;

        case 'pong':
          // Heartbeat response - connection is alive
          break;

        case 'system_metrics_update':
          queryClient.setQueryData(['/api/system-metrics'], message.data);
          break;

        case 'wallet_status_update':
          // Update wallets cache
          queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
          break;

        case 'activity_feed_update':
          // Update activities cache
          queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
          break;

        case 'bundle_analytics_update':
          queryClient.setQueryData(['/api/bundles/analytics'], message.data);
          break;

        case 'launch_plan_update':
          queryClient.invalidateQueries({ queryKey: ['/api/launch-plans'] });
          break;

        case 'bundle_execution_update':
          queryClient.invalidateQueries({ queryKey: ['/api/bundle-executions'] });
          break;

        case 'environment_update':
          queryClient.invalidateQueries({ queryKey: ['/api/environment-configs'] });
          break;

        case 'error':
          console.error('WebSocket error message:', message.data);
          setConnectionStatus(prev => ({ ...prev, error: message.data.message }));
          break;

        default:
          console.log('Unknown WebSocket message type:', message.type);
      }

      // Call custom message handlers
      const handler = messageHandlersRef.current.get(message.type);
      if (handler) {
        handler(message.data);
      }

      // Call global message handler
      onMessage?.(message);

    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [queryClient, onMessage]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      setConnectionStatus(prev => ({ ...prev, connecting: true, error: null }));
      
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          error: null,
          lastConnected: new Date(),
          reconnectAttempts: 0,
        }));
        
        // Re-subscribe to channels
        subscriptionsRef.current.forEach(channel => {
          ws.send(JSON.stringify({ type: 'subscribe', channel }));
        });
        
        onConnect?.();
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          error: event.reason || 'Connection closed',
        }));
        
        wsRef.current = null;
        onDisconnect?.();

        // Attempt reconnection
        if (enabled && connectionStatus.reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(reconnectInterval * Math.pow(2, connectionStatus.reconnectAttempts), 30000);
          console.log(`Attempting to reconnect in ${delay}ms...`);
          
          setConnectionStatus(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (fallbackToPolling) {
          console.log('Max reconnection attempts reached, falling back to polling');
          // Re-enable polling by invalidating queries
          queryClient.invalidateQueries();
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus(prev => ({ ...prev, error: 'Connection error' }));
        onError?.(error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus(prev => ({ ...prev, connecting: false, error: 'Failed to connect' }));
    }
  }, [enabled, getWebSocketUrl, handleMessage, onConnect, onDisconnect, onError, reconnectInterval, maxReconnectAttempts, connectionStatus.reconnectAttempts, fallbackToPolling, queryClient]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setConnectionStatus(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
    }));
  }, [clearReconnectTimeout]);

  // Send message
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Subscribe to channel
  const subscribe = useCallback((channel: string) => {
    subscriptionsRef.current.add(channel);
    return sendMessage({ type: 'subscribe', channel });
  }, [sendMessage]);

  // Unsubscribe from channel
  const unsubscribe = useCallback((channel: string) => {
    subscriptionsRef.current.delete(channel);
    return sendMessage({ type: 'unsubscribe', channel });
  }, [sendMessage]);

  // Add message handler
  const addMessageHandler = useCallback((type: string, handler: (data: any) => void) => {
    messageHandlersRef.current.set(type, handler);
  }, []);

  // Remove message handler
  const removeMessageHandler = useCallback((type: string) => {
    messageHandlersRef.current.delete(type);
  }, []);

  // Send ping to keep connection alive
  const ping = useCallback(() => {
    return sendMessage({ type: 'ping' });
  }, [sendMessage]);

  // Initialize connection
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (!connectionStatus.connected) return;

    const interval = setInterval(() => {
      ping();
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(interval);
  }, [connectionStatus.connected, ping]);

  return {
    connectionStatus,
    connect,
    disconnect,
    sendMessage,
    subscribe,
    unsubscribe,
    addMessageHandler,
    removeMessageHandler,
    ping,
    isConnected: connectionStatus.connected,
    isConnecting: connectionStatus.connecting,
    hasError: !!connectionStatus.error,
  };
}

// Hook specifically for real-time updates (includes backend status tracking)
export function useRealTimeWebSocket() {
  const queryClient = useQueryClient();
  
  // Use the real-time updates hook to track backend connection status
  useRealTimeUpdates();
  
  const websocket = useWebSocket({
    enabled: true,
    fallbackToPolling: true,
    onConnect: () => {
      console.log('Real-time WebSocket connected');
    },
    onDisconnect: () => {
      console.log('Real-time WebSocket disconnected');
    },
  });

  useEffect(() => {
    if (websocket.isConnected) {
      // Subscribe to all real-time channels
      websocket.subscribe('system_metrics');
      websocket.subscribe('activities');
      websocket.subscribe('bundle_analytics');
      websocket.subscribe('launch_plans');
      websocket.subscribe('bundle_executions');
      websocket.subscribe('environment');
    }
  }, [websocket.isConnected, websocket]);

  return {
    ...websocket,
    // Provide fallback data fetching functions for when WebSocket is not connected
    shouldUseFallback: !websocket.isConnected,
  };
}