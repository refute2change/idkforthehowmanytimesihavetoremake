// app/context/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { socket } from '../socket';

interface SocketContextType {
  isConnected: boolean;
  notifications: any[];
  currentRoom: string | null;
  connectSocket: (role: 'host-server' | 'regular-client', hostKey: string) => void;    
  disconnectSocket: () => void; 
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    
    socket.on('disconnect', () => {
      setIsConnected(false);
      setCurrentRoom(null);
    });

    socket.on('registration-success', ({ hostKey }) => {
      setCurrentRoom(hostKey);
    });

    // Catch rejection errors from the backend server
    socket.on('connection-error', (errorMessage: string) => {
      alert(`Connection Failed: ${errorMessage}`);
      setIsConnected(false);
      setCurrentRoom(null);
    });

    socket.on('new-notification', (data: any) => {
      setNotifications((prev) => [...prev, data]);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('registration-success');
      socket.off('connection-error');
      socket.off('new-notification');
    };
  }, []);

  const connectSocket = (role: 'host-server' | 'regular-client', hostKey: string) => {
    if (!socket.connected) {
      socket.connect();
      
      socket.once('connect', () => {
        // Send both chosen parameters down the pipe immediately on connection
        socket.emit('register-role', { role, hostKey });
      });
    }
  };

  const disconnectSocket = () => {
    if (socket.connected) {
      socket.disconnect();
    }
  };

  return (
    <SocketContext.Provider value={{ isConnected, notifications, currentRoom, connectSocket, disconnectSocket }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
}