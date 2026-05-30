// app/components/ConnectionManager.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router'; // Import the router navigate hook
import { useSocket } from './SocketContext';

interface ConnectionManagerProps {
  selectedRole: 'host-server' | 'regular-client';
  onRoleChange: (role: 'host-server' | 'regular-client') => void;
  clientName: string;
}

export function ConnectionManager({ selectedRole, onRoleChange, clientName }: ConnectionManagerProps) {
  const { isConnected, currentRoom, connectSocket, disconnectSocket } = useSocket();
  const [hostKey, setHostKey] = useState('');
  
  const navigate = useNavigate(); // Initialize the navigator

  // 1. WATCH FOR SUCCESSFUL CONNECTION TO REDIRECT
  useEffect(() => {
    if (isConnected && currentRoom) {
      if (selectedRole === 'host-server') {
        // Automatically redirect to the host dashboard route
        navigate('/host');
      } else if (selectedRole === 'regular-client') {
        // You can redirect regular clients to a separate view if you want!
        navigate('/play'); 
      }
    }
  }, [isConnected, currentRoom, selectedRole, navigate]);

  const handleConnect = () => {
    if (!hostKey.trim()) {
      alert('Please enter a Host Server / Room ID key!');
      return;
    }

    if (selectedRole === 'regular-client' && !clientName.trim()) {
      alert('Please enter your name to connect as a client.');
      return;
    }

    connectSocket(selectedRole, hostKey.trim(), selectedRole === 'regular-client' ? clientName.trim() : undefined);
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #333', borderRadius: '8px', backgroundColor: '#1e1e1e', color: '#fff', maxWidth: '400px' }}>
      <h3>Room Router Dashboard</h3>
      <p>
        Status: <span style={{ color: isConnected && currentRoom ? '#4CAF50' : '#f44336' }}>
          {isConnected && currentRoom ? `🟢 Connected to Room [${currentRoom}]` : "🔴 Disconnected"}
        </span>
      </p>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>1. Connection Key:</label>
        <input 
          type="text"
          placeholder="e.g. ROOM_ALPHA"
          value={hostKey}
          onChange={(e) => setHostKey(e.target.value)}
          disabled={isConnected}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2d2d2d', color: '#fff', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>2. Choose Identity:</label>
        <select
          value={selectedRole}
          onChange={(e) => onRoleChange(e.target.value as 'host-server' | 'regular-client')}
          disabled={isConnected}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#2d2d2d', color: '#fff' }}
        >
          <option value="regular-client">👤 Regular Client (Connect to existing)</option>
          <option value="host-server">👑 Host Server (Register new workspace)</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={handleConnect} disabled={isConnected} style={{ flex: 1, backgroundColor: isConnected ? '#555' : '#4CAF50', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', cursor: isConnected ? 'not-allowed' : 'pointer' }}>
          {selectedRole === 'regular-client' ? 'Connect' : 'Initialize'}
        </button>
        <button onClick={disconnectSocket} disabled={!isConnected} style={{ flex: 1, backgroundColor: !isConnected ? '#555' : '#f44336', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', cursor: !isConnected ? 'not-allowed' : 'pointer' }}>
          Disconnect
        </button>
      </div>
    </div>
  );
}