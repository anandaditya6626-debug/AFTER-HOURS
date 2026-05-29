'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  globalCount: number;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  globalCount: 0,
});

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [globalCount, setGlobalCount] = useState(0);

  useEffect(() => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

    const s = io(BACKEND, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 800,
      timeout: 10000,
    });

    s.on('connect', () => {
      console.log('[Socket] Connected:', s.id);
      setIsConnected(true);
      setSocket(s);
    });

    s.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    s.on('connect_error', (err) => {
      console.warn('[Socket] connect_error:', err.message);
    });

    s.on('global-count', ({ count }: { count: number }) => {
      setGlobalCount(count);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, globalCount }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
