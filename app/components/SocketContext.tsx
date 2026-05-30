// app/context/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { socket } from '../socket';

interface ConnectedClient {
  id: string;
  name: string;
}

interface SocketContextType {
  isConnected: boolean;
  notifications: any[];
  currentRoom: string | null;
  role: 'host-server' | 'regular-client' | null;
  connectedClients: ConnectedClient[];
  connectSocket: (role: 'host-server' | 'regular-client', hostKey: string, clientName?: string) => void;
  disconnectSocket: () => void; 
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [role, setRole] = useState<'host-server' | 'regular-client' | null>(null);
  const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>([]);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    
    socket.on('disconnect', () => {
      setIsConnected(false);
      setCurrentRoom(null);
      setRole(null);
      setConnectedClients([]);
    });

    socket.on('registration-success', ({ role: registeredRole, hostKey }) => {
      setRole(registeredRole);
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

    socket.on('kicked', (message: string) => {
      alert(message || 'You have been kicked from the room.');
      socket.disconnect();
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('registration-success');
      socket.off('connection-error');
      socket.off('new-notification');
      socket.off('kicked');
    };
  }, []);

  useEffect(() => {
    function handleOpenRound2() {
      if (role === 'regular-client') {
        navigate('/play/round2');
      }
    }

    function handleTerminateGame() {
      if (role !== 'host-server') {
        navigate('/play');
      }
    }

    function addOrUpdateClient(client: ConnectedClient) {
      setConnectedClients((prev) => {
        const existing = prev.find((item) => item.id === client.id);
        if (existing) {
          return prev.map((item) => (item.id === client.id ? { ...item, name: client.name } : item));
        }
        return [...prev, client];
      });
    }

    function removeClient(clientId: string) {
      setConnectedClients((prev) => prev.filter((client) => client.id !== clientId));
    }

    function handleClientConnected(data: any) {
      if (role !== 'host-server') return;
      if (data.clientId) {
        addOrUpdateClient({
          id: data.clientId,
          name: data.clientName || `Client ${data.clientId.slice(0, 6)}`,
        });
      }
    }

    function handleClientDisconnected(data: any) {
      if (role !== 'host-server') return;
      if (data.clientId) {
        removeClient(data.clientId);
      }
    }

    function handleClientSignal(data: any) {
      if (role !== 'host-server') return;
      if (data.senderId) {
        addOrUpdateClient({
          id: data.senderId,
          name: data.clientName || `Client ${data.senderId.slice(0, 6)}`,
        });
      }
    }

    socket.on('open-round2', handleOpenRound2);
    socket.on('terminate-game', handleTerminateGame);
    socket.on('client-connected', handleClientConnected);
    socket.on('client-disconnected', handleClientDisconnected);
    socket.on('client-signal', handleClientSignal);

    return () => {
      socket.off('open-round2', handleOpenRound2);
      socket.off('terminate-game', handleTerminateGame);
      socket.off('client-connected', handleClientConnected);
      socket.off('client-disconnected', handleClientDisconnected);
      socket.off('client-signal', handleClientSignal);
    };
  }, [role, navigate]);

  const connectSocket = (role: 'host-server' | 'regular-client', hostKey: string, clientName?: string) => {
    if (!socket.connected) {
      socket.connect();
      
      socket.once('connect', () => {
        // Send chosen parameters down the pipe immediately on connection
        socket.emit('register-role', { role, hostKey, clientName });
      });
    }
  };

  const disconnectSocket = () => {
    if (socket.connected) {
      socket.disconnect();
    }
  };

  return (
    <SocketContext.Provider value={{ isConnected, notifications, currentRoom, role, connectedClients, connectSocket, disconnectSocket }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
}