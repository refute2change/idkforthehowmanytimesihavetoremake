// app/routes/client/view.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../components/SocketContext';
import { socket } from '../../socket';
import { GameHeader } from '../../components/GameHeader';

export default function ClientView() {
  const { isConnected, currentRoom, connectedClients } = useSocket();
  const [hostReply, setHostReply] = useState<string>("");
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const navigate = useNavigate();

  const sortedClients = useMemo(() => {
    if (orderedIds.length === 0) return connectedClients;
    return [...connectedClients].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
  }, [connectedClients, orderedIds]);

  useEffect(() => {
    if (!isConnected || !currentRoom) navigate('/');
  }, [isConnected, currentRoom, navigate]);

  useEffect(() => {
    if (!isConnected) return;
    const handleHostSignal = (payload: string) => setHostReply(payload);
    const handleOrderUpdate = (data: { orderedIds: string[] }) => setOrderedIds(data.orderedIds);
    
    socket.on('host-signal', handleHostSignal);
    socket.on('update-player-order', handleOrderUpdate);
    socket.on('open-round2', () => navigate('/play/round2'));
    socket.on('open-round4', () => navigate('/play/round4'));
    socket.on('host-offline-evict', () => navigate('/'));

    return () => {
      socket.off('host-signal', handleHostSignal);
      socket.off('update-player-order', handleOrderUpdate);
      socket.off('open-round2');
      socket.off('open-round4');
      socket.off('host-offline-evict');
    };
  }, [isConnected, navigate]);

  useEffect(() => {
    if (isConnected && currentRoom) {
      // Request current order from server upon entry
      socket.emit('update-player-order', { hostKey: currentRoom });
    }
  }, [isConnected, currentRoom]);

  const sendSignalToHost = () => {
    if (currentRoom) socket.emit('message-to-host', { hostKey: currentRoom, payload: { text: "Ping!", timestamp: Date.now() } });
  };

  if (!isConnected || !currentRoom) return <div style={{ color: '#fff', padding: '20px' }}>Connecting...</div>;

  return (
    <div style={{ padding: "20px", color: "#fff", backgroundColor: "#121212", minHeight: "100vh" }}>
      <GameHeader title="👤 Standard Client Panel" />
      <button 
        onClick={sendSignalToHost} 
        style={{ 
          padding: "12px 24px", 
          marginBottom: "20px", 
          backgroundColor: "#333", // Distinct background
          color: "#fff",          // Visible text
          border: "1px solid #555",
          borderRadius: "6px",
          cursor: "pointer"
        }}
      >
        ⚡ Ping Host
      </button>
      <h2>Participants (Host-Ordered)</h2>
      {sortedClients.map(c => <div key={c.id}>{c.name}</div>)}
    </div>
  );
}