import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinShowRoom: (showId: string) => void;
  leaveShowRoom: (showId: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected:', socket.id);
    });
    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket] Disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinShowRoom = (showId: string) => {
    socketRef.current?.emit('JOIN_SHOW_ROOM', showId);
  };

  const leaveShowRoom = (showId: string) => {
    socketRef.current?.emit('LEAVE_SHOW_ROOM', showId);
  };

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, joinShowRoom, leaveShowRoom }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
