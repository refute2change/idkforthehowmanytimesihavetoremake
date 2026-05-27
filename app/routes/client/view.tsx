// app/routes/client-view.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../components/SocketContext'; // FIX 1: Corrected context import path
import { socket } from '../../socket';

export default function ClientView() {
  const { isConnected, currentRoom, disconnectSocket } = useSocket();
  const [hostReply, setHostReply] = useState<string>("");
  const navigate = useNavigate();

  // FIX 2: SECURITY GUARD - Kick users out to home if they try to visit this page offline
  useEffect(() => {
    if (!isConnected || !currentRoom) {
      navigate('/'); // Bounce back to home.tsx / ConnectionManager
    }
  }, [isConnected, currentRoom, navigate]);

  // 3. LISTEN FOR LIVE SIGNALS FROM THE HOST
  useEffect(() => {
    if (!isConnected) return;

    function handleHostSignal(payload: string) {
      setHostReply(payload);
    }

    socket.on('host-signal', handleHostSignal);

    return () => {
      socket.off('host-signal', handleHostSignal);
    };
  }, [isConnected]);

  // Action function to send data straight up to the active host room
  const sendSignalToHost = () => {
    if (currentRoom) {
      socket.emit('message-to-host', { 
        hostKey: currentRoom, 
        payload: { text: "Hello from a regular peer client!", timestamp: Date.now() } 
      });
    }
  };

  const handleLeaveRoom = () => {
    disconnectSocket(); // Bounces user back to home via the security guard useEffect above
  };

  // Prevent UI flash before redirect triggers
  if (!isConnected || !currentRoom) {
    return <div style={{ color: '#fff', padding: '20px' }}>Connecting to workspace room...</div>;
  }

  return (
    <div style={{ padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>👤 Standard Client Panel</h1>
        <button 
          onClick={handleLeaveRoom} 
          style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer' }}
        >
          Leave Room
        </button>
      </div>

      <p>Connected to Host Room: <span style={{ color: '#4CAF50', fontFamily: 'monospace', fontSize: '1.2em' }}>{currentRoom}</span></p>
      
      <hr style={{ borderColor: '#333', margin: '20px 0' }} />

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={sendSignalToHost} 
          style={{ backgroundColor: '#008CBA', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '4px', fontSize: '1em', cursor: 'pointer' }}
        >
          ⚡ Ping Host Client
        </button>
      </div>

      {hostReply ? (
        <div style={{ backgroundColor: '#222', padding: '15px', borderRadius: '4px', borderLeft: '4px solid #4CAF50' }}>
          <strong>Latest Message from Host:</strong>
          <p style={{ margin: '5px 0 0 0', fontFamily: 'monospace' }}>{hostReply}</p>
        </div>
      ) : (
        <p style={{ color: '#888' }}>No responses from host yet. Click the button above to send a signal!</p>
      )}
    </div>
  );
}