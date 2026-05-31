import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../../components/SocketContext';
import { socket } from '../../../socket';

interface Round4AnswerEntry {
  id: string;
  name: string;
  answer: string;
  time: string;
}

interface Round4StealAttempt {
  id: string;
  name: string;
}

export default function HostRound4() {
  const { isConnected, currentRoom, disconnectSocket, connectedClients } = useSocket();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string>('');
  const [packValue, setPackValue] = useState(40);
  const [questionText, setQuestionText] = useState('');
  const [roundActive, setRoundActive] = useState(false);
  const [stealWindowOpen, setStealWindowOpen] = useState(false);
  const [currentStealAttempt, setCurrentStealAttempt] = useState<Round4StealAttempt | null>(null);
  const [answerLog, setAnswerLog] = useState<Round4AnswerEntry[]>([]);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [playerPoints, setPlayerPoints] = useState<{ [playerId: string]: number }>({});
  const [manualPoints, setManualPoints] = useState<{ [playerId: string]: string }>({});
  const navigate = useNavigate();

  const selectedPlayer = useMemo(() => {
    return connectedClients.find((client) => client.id === selectedPlayerId) || null;
  }, [connectedClients, selectedPlayerId]);

  useEffect(() => {
    if (!isConnected || !currentRoom) {
      navigate('/');
    }
  }, [isConnected, currentRoom, navigate]);

  useEffect(() => {
    if (!isConnected) return;

    const handleRound4Answer = (data: any) => {
      setAnswerLog((prev) => [
        {
          id: data.senderId,
          name: data.senderName || `Player ${data.senderId.slice(0, 6)}`,
          answer: data.answer,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      setActionLog((prev) => [`${data.senderName || data.senderId} answered: ${data.answer}`, ...prev]);
    };

    const handleStealFirst = (data: any) => {
      if (!data) return;
      setCurrentStealAttempt({ id: data.playerId, name: data.playerName });
      setActionLog((prev) => [`Steal attempt by ${data.playerName}`, ...prev]);
    };

    const handleStealWindowOpen = () => {
      setStealWindowOpen(true);
      setCurrentStealAttempt(null);
      setActionLog((prev) => ['Steal window opened', ...prev]);
    };

    const handleStealWindowClose = () => {
      setStealWindowOpen(false);
      setCurrentStealAttempt(null);
      setActionLog((prev) => ['Steal window closed', ...prev]);
    };

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

    socket.on('round4-answer', handleRound4Answer);
    socket.on('round4-steal-first', handleStealFirst);
    socket.on('round4-open-steal-window', handleStealWindowOpen);
    socket.on('round4-close-steal-window', handleStealWindowClose);
    socket.on('player-points-response', handlePlayerPointsResponse);
    socket.on('player-points-awarded', handlePlayerPointsAwarded);

    return () => {
      socket.off('round4-answer', handleRound4Answer);
      socket.off('round4-steal-first', handleStealFirst);
      socket.off('round4-open-steal-window', handleStealWindowOpen);
      socket.off('round4-close-steal-window', handleStealWindowClose);
      socket.off('player-points-response', handlePlayerPointsResponse);
      socket.off('player-points-awarded', handlePlayerPointsAwarded);
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
  }, [isConnected, connectedClients, currentRoom]);

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
      const newTotal = operation === 'set' ? value : current + value;
      return { ...prev, [playerId]: newTotal };
    });
  };

  const handleManualPointsChange = (playerId: string, value: string) => {
    setManualPoints((prev) => ({ ...prev, [playerId]: value }));
  };

  const handleSetPlayerPoints = (playerId: string) => {
    const raw = manualPoints[playerId];
    const newValue = Number(raw);
    if (Number.isNaN(newValue)) return;
    adjustPlayerPoints(playerId, newValue, 'set');
  };

  const handleAddPlayerPoints = (playerId: string) => {
    const raw = manualPoints[playerId];
    const delta = Number(raw);
    if (Number.isNaN(delta)) return;
    adjustPlayerPoints(playerId, delta, 'add');
  };

  const choosePlayer = (clientId: string, clientName: string) => {
    setSelectedPlayerId(clientId);
    setSelectedPlayerName(clientName);
  };

  const startQuestion = () => {
    if (!currentRoom || !selectedPlayerId || !questionText.trim()) return;
    socket.emit('round4-start-question', {
      hostKey: currentRoom,
      question: questionText.trim(),
      value: packValue,
      star: false,
      activePlayerId: selectedPlayerId,
      activePlayerName: selectedPlayerName,
      duration: 20,
    });
    setRoundActive(true);
    setStealWindowOpen(false);
    setCurrentStealAttempt(null);
    setActionLog((prev) => [`Started Round4 question for ${selectedPlayerName} (${packValue} points)`, ...prev]);
  };

  const markActiveCorrect = () => {
    if (!currentRoom || !selectedPlayerId) return;
    socket.emit('round4-answer-verdict', {
      hostKey: currentRoom,
      targetClientId: selectedPlayerId,
      correct: true,
      points: packValue,
      message: `Correct answer! +${packValue} points awarded.`,
    });
    setRoundActive(false);
    setStealWindowOpen(false);
    setCurrentStealAttempt(null);
    setActionLog((prev) => [`${selectedPlayerName} answered correctly and earned ${packValue} points.`, ...prev]);
  };

  const markActiveIncorrect = () => {
    if (!currentRoom || !selectedPlayerId) return;
    socket.emit('round4-answer-verdict', {
      hostKey: currentRoom,
      targetClientId: selectedPlayerId,
      correct: false,
      points: 0,
      message: 'Incorrect answer. Steal window is now open.',
    });
    socket.emit('round4-open-steal-window', { hostKey: currentRoom });
    setRoundActive(false);
    setStealWindowOpen(true);
    setActionLog((prev) => [`${selectedPlayerName} answered incorrectly. Steal window opened.`, ...prev]);
  };

  const acceptSteal = () => {
    if (!currentRoom || !currentStealAttempt) return;
    const stealPoints = Math.max(0, Math.floor(packValue / 2));
    socket.emit('round4-steal-verdict', {
      hostKey: currentRoom,
      targetClientId: currentStealAttempt.id,
      correct: true,
      points: stealPoints,
      message: `Steal successful! +${stealPoints} points awarded.`,
    });
    socket.emit('round4-close-steal-window', { hostKey: currentRoom });
    setStealWindowOpen(false);
    setActionLog((prev) => [`Steal accepted for ${currentStealAttempt.name}, awarded ${stealPoints} points.`, ...prev]);
  };

  const denySteal = () => {
    if (!currentRoom || !currentStealAttempt) return;
    socket.emit('round4-steal-verdict', {
      hostKey: currentRoom,
      targetClientId: currentStealAttempt.id,
      correct: false,
      points: 0,
      message: 'Steal denied.',
    });
    socket.emit('round4-close-steal-window', { hostKey: currentRoom });
    setStealWindowOpen(false);
    setActionLog((prev) => [`Steal denied for ${currentStealAttempt.name}.`, ...prev]);
  };

  const closeStealWindow = () => {
    if (!currentRoom) return;
    socket.emit('round4-close-steal-window', { hostKey: currentRoom });
    setStealWindowOpen(false);
    setCurrentStealAttempt(null);
    setActionLog((prev) => ['Steal window manually closed.', ...prev]);
  };

  const terminateGame = () => {
    if (!currentRoom) return;
    socket.emit('terminate-game', { hostKey: currentRoom });
    navigate('/host');
  };

  const handleLeave = () => {
    disconnectSocket();
  };

  if (!isConnected || !currentRoom) {
    return <div style={{ color: '#fff', padding: '20px' }}>Loading Round4 game...</div>;
  }

  return (
    <div style={{ padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Host Round4 Game</h1>
          <p>Room: <span style={{ color: '#4CAF50', fontFamily: 'monospace' }}>{currentRoom}</span></p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => navigate('/host')} style={{ backgroundColor: '#555', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            Back to Dashboard
          </button>
          <button onClick={terminateGame} style={{ backgroundColor: '#f4a261', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            Terminate Game
          </button>
          <button onClick={handleLeave} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            Leave Game
          </button>
        </div>
      </div>

      <hr style={{ borderColor: '#333', margin: '20px 0' }} />

      <section style={{ marginBottom: '24px' }}>
        <h2>Round4 Setup</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
          <div style={{ backgroundColor: '#181818', border: '1px solid #333', borderRadius: '12px', padding: '16px' }}>
            <h3>Select active player</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {connectedClients.length === 0 ? (
                <p style={{ color: '#888' }}>No players connected yet.</p>
              ) : (
                connectedClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => choosePlayer(client.id, client.name)}
                    style={{
                      padding: '12px',
                      backgroundColor: client.id === selectedPlayerId ? '#2a9d8f' : '#111',
                      color: '#fff',
                      border: '1px solid #333',
                      borderRadius: '10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {client.name}
                  </button>
                ))
              )}
            </div>
          </div>

          <div style={{ backgroundColor: '#181818', border: '1px solid #333', borderRadius: '12px', padding: '16px' }}>
            <h3>Select pack value</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {[40, 60, 80].map((value) => (
                <button
                  key={value}
                  onClick={() => setPackValue(value)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: packValue === value ? '#2a9d8f' : '#111',
                    color: '#fff',
                    border: '1px solid #333',
                    borderRadius: '10px',
                    cursor: 'pointer',
                  }}
                >
                  {value} pts
                </button>
              ))}
            </div>
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Question prompt</label>
              <textarea
                rows={4}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', backgroundColor: '#111', color: '#fff' }}
                placeholder="Enter the Round4 question here"
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: '18px' }}>
          <button
            onClick={startQuestion}
            disabled={!selectedPlayerId || !questionText.trim()}
            style={{
              padding: '14px 20px',
              backgroundColor: !selectedPlayerId || !questionText.trim() ? '#555' : '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: !selectedPlayerId || !questionText.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            Start Round4 Question
          </button>
        </div>
      </section>

      <section style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        <div style={{ backgroundColor: '#181818', borderRadius: '12px', border: '1px solid #333', padding: '16px' }}>
          <h2>Current Question</h2>
          <p style={{ color: '#ccc' }}>Active player: <strong>{selectedPlayerName || 'None'}</strong></p>
          <p style={{ color: '#ccc' }}>Pack value: <strong>{packValue} pts</strong></p>
          <div style={{ marginTop: '12px', backgroundColor: '#121212', borderRadius: '10px', padding: '16px', minHeight: '110px' }}>
            {questionText ? <p style={{ margin: 0 }}>{questionText}</p> : <p style={{ margin: 0, color: '#888' }}>No question started yet.</p>}
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={markActiveCorrect}
              disabled={!roundActive}
              style={{
                padding: '12px 16px',
                backgroundColor: roundActive ? '#2a9d8f' : '#555',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: roundActive ? 'pointer' : 'not-allowed',
              }}
            >
              Mark Correct
            </button>
            <button
              onClick={markActiveIncorrect}
              disabled={!roundActive}
              style={{
                padding: '12px 16px',
                backgroundColor: roundActive ? '#e63946' : '#555',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: roundActive ? 'pointer' : 'not-allowed',
              }}
            >
              Mark Incorrect / Open Steal
            </button>
          </div>
          {stealWindowOpen && (
            <div style={{ marginTop: '16px', padding: '14px', backgroundColor: '#111', borderRadius: '10px', border: '1px solid #333' }}>
              <h3 style={{ margin: 0, marginBottom: '10px' }}>Steal Window</h3>
              {currentStealAttempt ? (
                <>
                  <p style={{ margin: '0 0 10px' }}><strong>{currentStealAttempt.name}</strong> is attempting the steal.</p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={acceptSteal} style={{ padding: '10px 14px', backgroundColor: '#2a9d8f', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Accept Steal</button>
                    <button onClick={denySteal} style={{ padding: '10px 14px', backgroundColor: '#d62828', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Deny Steal</button>
                  </div>
                </>
              ) : (
                <p style={{ margin: '0' }}>Waiting for a player to attempt the steal...</p>
              )}
              <button onClick={closeStealWindow} style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
                Close Steal Window
              </button>
            </div>
          )}
        </div>

        <div style={{ backgroundColor: '#181818', borderRadius: '12px', border: '1px solid #333', padding: '16px' }}>
          <h2>Scoreboard</h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            {connectedClients.map((client) => (
              <div key={client.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '10px', alignItems: 'center', padding: '10px', backgroundColor: '#111', borderRadius: '10px' }}>
                <div>
                  <strong>{client.name}</strong>
                  <div style={{ color: '#888', fontSize: '0.9rem' }}>{client.id.slice(0, 6)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '1.2rem', color: '#4CAF50' }}>{playerPoints[client.id] || 0}</p>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="+/- or set"
                    value={manualPoints[client.id] || ''}
                    onChange={(e) => handleManualPointsChange(client.id, e.target.value)}
                    style={{ width: '100px', padding: '8px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#121212', color: '#fff' }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button onClick={() => handleSetPlayerPoints(client.id)} style={{ flex: 1, padding: '8px', backgroundColor: '#2a9d8f', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}>Set</button>
                    <button onClick={() => handleAddPlayerPoints(client.id)} style={{ flex: 1, padding: '8px', backgroundColor: '#4CAF50', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}>Add</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Action Log</h2>
        <div style={{ maxHeight: '260px', overflowY: 'auto', padding: '16px', backgroundColor: '#111', borderRadius: '12px', border: '1px solid #333' }}>
          {actionLog.length === 0 ? (
            <p style={{ color: '#888' }}>No actions recorded yet.</p>
          ) : (
            actionLog.map((entry, index) => (
              <div key={`${entry}-${index}`} style={{ marginBottom: '10px' }}>
                <span style={{ color: '#ddd' }}>{entry}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
