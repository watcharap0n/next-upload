import { useEffect, useRef, useState, useCallback } from 'react';

interface UploadStatus {
  processing_status: string;
  progress_percent: number;
  upload_status: string;
  filename: string;
  upload_speed?: number;
  eta_seconds?: number;
  bytes_uploaded?: number;
  total_bytes?: number;
  current_part?: number;
  total_parts?: number;
  error_code?: string;
  error_message?: string;
  timestamp?: string;
  server_message?: string;
}

interface WebSocketMessage {
  type: 'initial_status' | 'upload_status' | 'status_update' | 'error' | 'complete' | 'heartbeat';
  data: UploadStatus;
  timestamp: string;
}

interface UseUploadWebSocketReturn {
  status: UploadStatus | null;
  isConnected: boolean;
  error: string | null;
  connectionHistory: string[];
  requestStatus: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

export const useUploadWebSocket = (
  uploadId: string | null,
  userId: string | null,
  token: string | null
): UseUploadWebSocketReturn => {
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionHistory, setConnectionHistory] = useState<string[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const addConnectionLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionHistory(prev => [`${timestamp} - ${message}`, ...prev].slice(0, 50));
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!uploadId || !userId || !token) {
      addConnectionLog('Missing required parameters for WebSocket connection');
      return;
    }

    // Close existing connection if any
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.close();
    }

    const websocketUrl= `${process.env.WEBSOCKET_BASE_URL || 'ws://localhost:8081'}/api/ws/upload/${uploadId}?user_id=${userId}&token=${token}`;
    try {
      const wsUrl = websocketUrl.replace(/^http/, 'ws');
      addConnectionLog(`Attempting to connect to WebSocket: ${wsUrl}`);

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        addConnectionLog('✅ WebSocket connected successfully');

        // Request initial status
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'get_status' }));
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          addConnectionLog(`📨 Received message: ${message.type}`);

          if (message.type === 'initial_status' ||
              message.type === 'upload_status' ||
              message.type === 'status_update') {
            setStatus(message.data);
          } else if (message.type === 'error') {
            setError(message.data.error_message || 'Unknown error');
            addConnectionLog(`❌ Server error: ${message.data.error_message}`);
          } else if (message.type === 'complete') {
            setStatus(message.data);
            addConnectionLog('🎉 Upload completed successfully');
          } else if (message.type === 'heartbeat') {
            addConnectionLog('💓 Heartbeat received');
          }
        } catch (err) {
          addConnectionLog(`❌ Failed to parse message: ${err}`);
        }
      };

      ws.current.onclose = (event) => {
        setIsConnected(false);
        addConnectionLog(`🔌 WebSocket disconnected (Code: ${event.code})`);

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          addConnectionLog(`🔄 Reconnecting in ${delay/1000}s (Attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connectWebSocket();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          addConnectionLog('❌ Max reconnection attempts reached');
          setError('Connection lost - max reconnection attempts reached');
        }
      };

      ws.current.onerror = () => {
        addConnectionLog('❌ WebSocket error occurred');
        setError('WebSocket connection failed');
        setIsConnected(false);
      };

    } catch (err) {
      addConnectionLog(`❌ Failed to create WebSocket: ${err}`);
      setError('Failed to create WebSocket connection');
    }
  }, [uploadId, userId, token, addConnectionLog]);

  // Connect on mount or when parameters change
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      ws.current?.close();
    };
  }, [connectWebSocket]);

  const requestStatus = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'get_status' }));
      addConnectionLog('📤 Status request sent');
    } else {
      addConnectionLog('❌ Cannot request status - WebSocket not connected');
    }
  }, [addConnectionLog]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    ws.current?.close(1000, 'Manual disconnect');
    addConnectionLog('🔌 Manual disconnect requested');
  }, [addConnectionLog]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    addConnectionLog('🔄 Manual reconnection requested');
    connectWebSocket();
  }, [connectWebSocket, addConnectionLog]);

  return {
    status,
    isConnected,
    error,
    connectionHistory,
    requestStatus,
    disconnect,
    reconnect
  };
};
