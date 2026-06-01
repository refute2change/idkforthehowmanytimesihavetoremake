// app/routes/host/dashboard.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../components/SocketContext';
import { socket } from '../../socket';
import { GameHeader } from '../../components/GameHeader';

export default function HostDashboard() {
  const { isConnected, currentRoom, connectedClients } = useSocket();
  const [incomingSignals, setIncomingSignals] = useState<any[]>([]);
  const [playerPoints, setPlayerPoints] = useState<{ [playerId: string]: number }>({});
  const [manualPoints, setManualPoints] = useState<{ [playerId: string]: string }>({});
  const [orderedClients, setOrderedClients] = useState(connectedClients);
  const navigate = useNavigate();

  const styles = {
    wrapper: { padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh', fontFamily: 'sans-serif' },
    btnCluster: { display: 'flex', gap: '12px', marginBottom: '20px' },
    btn2: { backgroundColor: '#008CBA', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer' },
    btn4: { backgroundColor: '#8E24AA', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer' },
    card: { padding: '16px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px', marginBottom: '12px' },
    formRow: { display: 'flex', gap: '8px', marginTop: '10px' },
    input: { width: '120px', padding: '8px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#121212', color: '#fff' },
    utilBtn: { padding: '8px 12px', borderRadius: '6px', border: 'none', color: '#fff', cursor: 'pointer' },
    moveBtn: (disabled: boolean) => ({
      padding: '4px 10px',
      border: '1px solid #444',
      borderRadius: '4px',
      backgroundColor: disabled ? '#222' : '#333',
      color: disabled ? '#555' : '#fff',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '0.8rem',
      fontWeight: 'bold'
    })
  };

  useEffect(() => {
    if (!isConnected || !currentRoom) navigate('/');
  }, [isConnected, currentRoom, navigate]);

  useEffect(() => { setOrderedClients(connectedClients); }, [connectedClients]);

  useEffect(() => {
    if (!isConnected) return;
    const handleSignal = (data: any) => setIncomingSignals((prev) => [...prev, data]);
    const handlePoints = (data: any) => data.playerId && setPlayerPoints((p) => ({ ...p, [data.playerId]: data.points }));

    socket.on('client-signal', handleSignal);
    socket.on('player-points-response', handlePoints);
    socket.on('player-points-awarded', handlePoints);

    return () => {
      socket.off('client-signal', handleSignal);
      socket.off('player-points-response', handlePoints);
      socket.off('player-points-awarded', handlePoints);
    };
  }, [isConnected]);

  const movePlayer = (index: number, direction: -1 | 1) => {
    const newOrder = [...orderedClients];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setOrderedClients(newOrder);
    socket.emit('reorder-players', { hostKey: currentRoom, orderedIds: newOrder.map(c => c.id) });
  };

  const changePoints = (id: string, op: 'set' | 'add') => {
    const val = Number(manualPoints[id]);
    if (Number.isNaN(val)) return;
    socket.emit('adjust-player-points', { hostKey: currentRoom, targetClientId: id, points: val, operation: op });
    setPlayerPoints(p => ({ ...p, [id]: op === 'set' ? val : (p[id] || 0) + val }));
  };

  if (!isConnected || !currentRoom) return <div style={{ color: '#fff', padding: '20px' }}>Loading...</div>;

  return (
    <div style={styles.wrapper}>
      <GameHeader title="👑 Host Server Workspace" />

      <div style={styles.btnCluster}>
        <button onClick={() => { socket.emit('open-round2', { hostKey: currentRoom }); navigate('/host/round2'); }} style={styles.btn2}>Open Round2 Game</button>
        <button onClick={() => { socket.emit('open-round4', { hostKey: currentRoom }); navigate('/host/round4'); }} style={styles.btn4}>Open Round4 Game</button>
      </div>

      <h2>Connected Clients ({orderedClients.length})</h2>
      {orderedClients.map((client, index) => (
        <div key={client.id} style={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <button 
              style={styles.moveBtn(index === 0)} 
              onClick={() => movePlayer(index, -1)} 
              disabled={index === 0}
            >▲</button>
            <button 
              style={styles.moveBtn(index === orderedClients.length - 1)} 
              onClick={() => movePlayer(index, 1)} 
              disabled={index === orderedClients.length - 1}
            >▼</button>
            <strong>{client.name}</strong> <span style={{ color: '#4CAF50' }}>({playerPoints[client.id] || 0} pts)</span>
          </div>
          <div style={styles.formRow}>
            <input type="number" placeholder="Value" value={manualPoints[client.id] ?? ''} onChange={(e) => setManualPoints({ ...manualPoints, [client.id]: e.target.value })} style={styles.input} />
            <button onClick={() => changePoints(client.id, 'add')} style={{ ...styles.utilBtn, backgroundColor: '#4CAF50' }}>Add</button>
            <button onClick={() => changePoints(client.id, 'set')} style={{ ...styles.utilBtn, backgroundColor: '#FFA000' }}>Set</button>
          </div>
        </div>
      ))}
    </div>
  );
}