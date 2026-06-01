import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../components/SocketContext';
import { socket } from '../../socket';

export default function HostDashboard() {
  const { isConnected, currentRoom, disconnectSocket, connectedClients } = useSocket();
  const [incomingSignals, setIncomingSignals] = useState<any[]>([]);
  const [playerPoints, setPlayerPoints] = useState<{ [playerId: string]: number }>({});
  const [manualPoints, setManualPoints] = useState<{ [playerId: string]: string }>({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConnected || !currentRoom) {
      navigate('/'); 
    }
  }, [isConnected, currentRoom, navigate]);

  useEffect(() => {
    if (!isConnected) return;

    function handleClientSignal(data: any) {
      setIncomingSignals((prev) => [...prev, data]);
      socket.emit('message-from-host', {
        targetClientId: data.senderId,
        payload: `Host processed your message at ${new Date().toLocaleTimeString()}`,
      });
    }

    socket.on('client-signal', handleClientSignal);
    return () => {
      socket.off('client-signal', handleClientSignal);
    };
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected || !currentRoom || connectedClients.length === 0) return;
    connectedClients.forEach((client) => {
      socket.emit('request-player-points', {
        hostKey: currentRoom,
        targetClientId: client.id,
      });
    });
  }, [isConnected, currentRoom, connectedClients]);

  useEffect(() => {
    if (!isConnected) return;

    const handlePlayerPointsResponse = (data: any) => {
      if (data.playerId && typeof data.points === 'number') {
        setPlayerPoints((prev) => ({ ...prev, [data.playerId]: data.points }));
      }
    };

    const handlePlayerPointsAwarded = (data: any) => {
      if (data.playerId && typeof data.points === 'number') {
        setPlayerPoints((prev) => ({ ...prev, [data.playerId]: data.points }));
      }
    };

    socket.on('player-points-response', handlePlayerPointsResponse);
    socket.on('player-points-awarded', handlePlayerPointsAwarded);

    return () => {
      socket.off('player-points-response', handlePlayerPointsResponse);
      socket.off('player-points-awarded', handlePlayerPointsAwarded);
    };
  }, [isConnected]);

  const adjustPlayerPoints = (playerId: string, value: number, operation: 'set' | 'add') => {
    if (!currentRoom) return;
    socket.emit('adjust-player-points', {
      hostKey: currentRoom,
      targetClientId: playerId,
      points: value,
      operation,
    });
    setPlayerPoints((prev) => {
      const current = prev[playerId] || 0;
      return { ...prev, [playerId]: operation === 'set' ? value : current + value };
    });
  };

  // Master Room Shutdown: Fires termination event to players before disconnecting the host
  const handleCloseWorkspace = () => {
    if (currentRoom) {
      // Broadcast the termination command so player clients redirect home/disconnect
      socket.emit('terminate-game', { hostKey: currentRoom });
    }
    // Disconnect host socket connection cleanly
    disconnectSocket();
  };

  if (!isConnected || !currentRoom) {
    return <div style={{ color: '#fff', padding: '20px' }}>Loading workspace...</div>;
  }

  return (
    <div style={{ padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>👑 Host Server Workspace</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => { socket.emit('open-round2', { hostKey: currentRoom }); navigate('/host/round2'); }} style={{ backgroundColor: '#008CBA', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer' }}>Open Round2 Game</button>
          <button onClick={() => { socket.emit('open-round4', { hostKey: currentRoom }); navigate('/host/round4'); }} style={{ backgroundColor: '#8E24AA', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer' }}>Open Round4 Game</button>
          
          {/* Linked to handleCloseWorkspace method handler */}
          <button onClick={handleCloseWorkspace} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Close Workspace</button>
        </div>
      </div>
      
      <p>Active Room Key: <span style={{ color: '#4CAF50', fontFamily: 'monospace', fontSize: '1.2em' }}>{currentRoom}</span></p>
      <hr style={{ borderColor: '#333', margin: '20px 0' }} />

      <section style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Connected Clients (Fixed Slot Sequence)</h3>
          <span style={{ color: '#888' }}>{connectedClients.length} connected</span>
        </div>
        <div style={{ display: 'grid', gap: '12px' }}>
          {connectedClients.length === 0 ? (
            <div style={{ padding: '16px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px', color: '#aaa' }}>No clients are connected yet.</div>
          ) : (
            connectedClients.map((client) => (
              <div key={client.id} style={{ padding: '16px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px', display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{client.name}</div>
                    <div style={{ color: '#888', fontSize: '0.9rem' }}>{client.id}</div>
                    <div style={{ color: '#4CAF50', fontSize: '0.95rem', marginTop: '4px' }}>{playerPoints[client.id] || 0} pts</div>
                  </div>
                  <button onClick={() => socket.emit('kick-client', { targetClientId: client.id })} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer' }}>Kick</button>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={manualPoints[client.id] ?? ''}
                    onChange={(e) => setManualPoints({ ...manualPoints, [client.id]: e.target.value })}
                    placeholder="+/- or set"
                    style={{ width: '120px', padding: '10px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#121212', color: '#fff' }}
                  />
                  <button onClick={() => adjustPlayerPoints(client.id, Number(manualPoints[client.id]), 'add')} style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', cursor: 'pointer' }}>Add</button>
                  <button onClick={() => adjustPlayerPoints(client.id, Number(manualPoints[client.id]), 'set')} style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#FFA000', color: '#fff', border: 'none', cursor: 'pointer' }}>Set</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <hr style={{ borderColor: '#333', margin: '20px 0' }} />
      <h3>Incoming Data Pipeline Logs:</h3>
      {incomingSignals.length === 0 ? (
        <p style={{ color: '#888' }}>Waiting for peer clients...</p>
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