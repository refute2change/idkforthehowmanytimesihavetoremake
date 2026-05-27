// app/routes/host-dashboard.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../components/SocketContext';
import { socket } from '../../socket';

export default function HostDashboard() {
  const { isConnected, currentRoom, disconnectSocket } = useSocket();
  const [incomingSignals, setIncomingSignals] = useState<any[]>([]);
  const navigate = useNavigate();

  // 1. SECURITY GUARD: Kick users out if they try to visit this page offline
  useEffect(() => {
    if (!isConnected || !currentRoom) {
      navigate('/'); // Bounce back to home.tsx
    }
  }, [isConnected, currentRoom, navigate]);

  // 2. LISTEN FOR LIVE PEER DATA
  useEffect(() => {
    // Only register listeners if we are actually connected
    if (!isConnected) return;

    function handleClientSignal(data: any) {
      setIncomingSignals(prev => [...prev, data]);
      
      // Automated response back to peer
      socket.emit('message-from-host', {
        targetClientId: data.senderId,
        payload: `Host processed your message at ${new Date().toLocaleTimeString()}`
      });
    }

    socket.on('client-signal', handleClientSignal);

    return () => {
      socket.off('client-signal', handleClientSignal);
    };
  }, [isConnected]);

  // A helper function so the admin can safely disconnect and go home
  const handleLeaveWorkspace = () => {
    disconnectSocket(); // This sets states to false/null, which automatically triggers our security guard useEffect to push us home
  };

  // Prevent flash of content if rendering before the security redirect fires
  if (!isConnected || !currentRoom) {
    return <div style={{ color: '#fff', padding: '20px' }}>Loading workspace...</div>;
  }

  return (
    <div style={{ padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>👑 Host Server Workspace</h1>
        <button onClick={handleLeaveWorkspace} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer' }}>
          Close Workspace
        </button>
      </div>
      
      <p>Active Room Key: <span style={{ color: '#4CAF50', fontFamily: 'monospace', fontSize: '1.2em' }}>{currentRoom}</span></p>
      
      <hr style={{ borderColor: '#333', margin: '20px 0' }} />
      
      <h3>Incoming Data Pipeline Logs:</h3>
      {incomingSignals.length === 0 ? (
        <p style={{ color: '#888' }}>Waiting for peer clients to input room key "{currentRoom}" and send signals...</p>
      ) : (
        <ul>
          {incomingSignals.map((sig, i) => (
            <li key={i} style={{ marginBottom: '8px', fontFamily: 'monospace', backgroundColor: '#222', padding: '10px', borderRadius: '4px' }}>
              <strong>From Client [{sig.senderId}]:</strong> {JSON.stringify(sig.payload)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}