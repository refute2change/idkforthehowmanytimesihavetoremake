import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../../components/SocketContext';
import { socket } from '../../../socket';

interface Clue {
  id: number;
  label: string;
  question: string;
  answer: string;
  used: boolean;
  opened: boolean;
  active: boolean;
}

interface PlayerAnswer {
  id: string;
  name: string;
  clueIndex: number;
  answer: string;
  time: string;
  accepted: boolean;
  keywordAttempted?: boolean;
}

interface KeywordAttempt {
  id: string;
  name: string;
  answer: string;
  time: string;
  rejectedEntry?: boolean; // Tracking custom property for evaluation safety checks
}

const initialClues: Clue[] = [
  { id: 0, label: 'Clue 1', question: 'A yellow fruit that monkeys love.', answer: 'banana', used: false, opened: false, active: false },
  { id: 1, label: 'Clue 2', question: 'The opposite of cold.', answer: 'hot', used: false, opened: false, active: false },
  { id: 2, label: 'Clue 3', question: 'A color made by mixing red and blue.', answer: 'purple', used: false, opened: false, active: false },
  { id: 3, label: 'Clue 4', question: 'The day that follows Friday.', answer: 'saturday', used: false, opened: false, active: false },
];

const finalClue: Clue = {
  id: 4,
  label: 'Final Clue',
  question: 'The thing players must discover to win the game.',
  answer: 'keyword',
  used: false,
  opened: false,
  active: false,
};

export default function HostRound2() {
  const { isConnected, currentRoom, disconnectSocket, connectedClients } = useSocket();
  const [clues, setClues] = useState<Clue[]>([...initialClues, finalClue]);
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [playerAnswers, setPlayerAnswers] = useState<PlayerAnswer[]>([]);
  const [keywordAttempts, setKeywordAttempts] = useState<KeywordAttempt[]>([]);
  const [gameWon, setGameWon] = useState(false);
  const [selectedClueRevealed, setSelectedClueRevealed] = useState(false);
  const [hostTimeLeft, setHostTimeLeft] = useState<number | null>(null);
  const [keywordWindowReady, setKeywordWindowReady] = useState(false);
  const [keywordWindowOpen, setKeywordWindowOpen] = useState(false);
  const [keywordTimeLeft, setKeywordTimeLeft] = useState<number | null>(null);
  const [playerPoints, setPlayerPoints] = useState<{ [playerId: string]: number }>({});
  const [manualPoints, setManualPoints] = useState<{ [playerId: string]: string }>({});
  
  // Historical ledger list tracking players who submitted completely wrong answers
  const [failedPlayerIds, setFailedPlayerIds] = useState<{ [playerId: string]: boolean }>({});

  const hostTimerRef = useRef<number | null>(null);
  const keywordTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  // Count only clues that have been selected and finalized, whether opened or rejected
  const clueCount = useMemo(
    () => clues.filter((clue) => clue.id !== 4 && clue.used && !clue.active).length,
    [clues],
  );
  const finalClueReady = clueCount >= 4;
  const finalClueVisible = clues.some((clue) => clue.id === 4 && !clue.used);
  const currentClueAnswers = useMemo(
    () => playerAnswers
      .map((answer, index) => ({ ...answer, originalIndex: index }))
      .filter((answer) => selectedClue && answer.clueIndex === selectedClue.id),
    [playerAnswers, selectedClue],
  );

  // FIX CONDITION: Checks if every single connected player is explicitly tracked inside the rejection ledger map
  const haveAllPlayersFailedKeyword = useMemo(() => {
    if (connectedClients.length === 0) return false;
    return connectedClients.every((client) => failedPlayerIds[client.id] === true);
  }, [connectedClients, failedPlayerIds]);

  useEffect(() => {
    if (!isConnected || !currentRoom) {
      navigate('/');
    }
  }, [isConnected, currentRoom, navigate]);

  useEffect(() => {
    if (!isConnected) return;

    const handlePlayerAnswer = (data: any) => {
      setPlayerAnswers((prev) => [
        {
          id: data.senderId,
          name: data.senderName || `Player ${data.senderId.slice(0, 6)}`,
          clueIndex: data.clueIndex,
          answer: data.answer,
          time: new Date().toLocaleTimeString(),
          accepted: false,
        },
        ...prev,
      ]);
    };

    const handleKeywordAttempt = (data: any) => {
      setKeywordAttempts((prev) => [
        {
          id: data.senderId,
          name: data.senderName || `Player ${data.senderId.slice(0, 6)}`,
          answer: data.answer,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    };

    const handleKeywordWindowClose = () => {
      setKeywordWindowOpen(false);
      setKeywordTimeLeft(null);
    };

    const handlePlayerAttemptedKeyword = (data: any) => {
      const clueIndex = typeof data.clueIndex === 'number' ? data.clueIndex : undefined;
      setPlayerAnswers((prev) => prev.map((answer) => {
        if (answer.id === data.senderId && (clueIndex === undefined || answer.clueIndex === clueIndex)) {
          return { ...answer, keywordAttempted: true };
        }
        return answer;
      }));
    };

    socket.on('player-answer', handlePlayerAnswer);
    socket.on('keyword-attempt', handleKeywordAttempt);
    socket.on('player-attempted-keyword', handlePlayerAttemptedKeyword);
    socket.on('close-keyword-window', handleKeywordWindowClose);

    return () => {
      socket.off('player-answer', handlePlayerAnswer);
      socket.off('keyword-attempt', handleKeywordAttempt);
      socket.off('player-attempted-keyword', handlePlayerAttemptedKeyword);
      socket.off('close-keyword-window', handleKeywordWindowClose);
    };
  }, [isConnected]);

  // Fetch accumulated player points from server when players connect
  useEffect(() => {
    if (!isConnected || connectedClients.length === 0 || !currentRoom) return;

    connectedClients.forEach((client) => {
      socket.emit('request-player-points', {
        hostKey: currentRoom,
        targetClientId: client.id,
      });
    });
  }, [isConnected, connectedClients, currentRoom]);

  // Listen for leaderboard updates and host point responses
  useEffect(() => {
    if (!isConnected) return;

    const handleLeaderboardUpdate = (data: any) => {
      if (Array.isArray(data.leaderboard)) {
        const pointsMap: { [playerId: string]: number } = {};
        data.leaderboard.forEach((entry: any) => {
          pointsMap[entry.playerId] = entry.points;
        });
        setPlayerPoints(pointsMap);
      }
    };

    const handlePlayerPointsResponse = (data: any) => {
      if (data.playerId && typeof data.points === 'number') {
        setPlayerPoints((prev) => ({
          ...prev,
          [data.playerId]: data.points,
        }));
      }
    };

    const handlePlayerPointsAwarded = (data: any) => {
      if (data.playerId && typeof data.points === 'number') {
        setPlayerPoints((prev) => ({
          ...prev,
          [data.playerId]: data.points,
        }));
      }
    };

    socket.on('leaderboard-update', handleLeaderboardUpdate);
    socket.on('player-points-response', handlePlayerPointsResponse);
    socket.on('player-points-awarded', handlePlayerPointsAwarded);

    return () => {
      socket.off('leaderboard-update', handleLeaderboardUpdate);
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

  const chooseClue = (clue: Clue) => {
    if (clue.used || gameWon || selectedClue) return;
    setClues((prev) => prev.map((item) => {
      if (item.id === clue.id) {
        return { ...item, used: true, active: true };
      }
      return { ...item, active: false };
    }));
    setSelectedClue(clue);
    socket.emit('select-clue', {
      hostKey: currentRoom,
      clueIndex: clue.id,
      final: clue.id === 4,
    });
    setSelectedClueRevealed(false);
  };

  const chooseFinalClue = () => {
    if (!finalClueVisible || gameWon) return;
    const final = clues.find((clue) => clue.id === 4);
    if (final) chooseClue(final);
  };

  const toggleAnswerAccepted = (originalIndex: number) => {
    setPlayerAnswers((prev) => prev.map((item, idx) => idx === originalIndex ? { ...item, accepted: !item.accepted } : item));
  };

  const finalizeClueJudgement = () => {
    if (!selectedClue) return;

    const currentAnswers = playerAnswers.filter((answer) => answer.clueIndex === selectedClue.id);
    const anyAccepted = currentAnswers.some((answer) => answer.accepted);

    currentAnswers.forEach((answer) => {
      socket.emit('clue-judgement', {
        hostKey: currentRoom,
        targetClientId: answer.id,
        clueIndex: answer.clueIndex,
        correct: answer.accepted,
        message: answer.accepted ? 'Your answer has been accepted as correct.' : 'Your answer was not accepted as correct.',
      });

      if (answer.accepted) {
        socket.emit('award-player-points', {
          hostKey: currentRoom,
          targetClientId: answer.id,
          points: 10,
        });
        setPlayerPoints((prev) => {
          return { ...prev, [answer.id]: (prev[answer.id] || 0) + 10 };
        });
      }
    });

    setClues((prev) => prev.map((clue) => {
      if (clue.id === selectedClue.id) {
        return { ...clue, opened: anyAccepted, active: false };
      }
      return clue;
    }));

    socket.emit('clue-state-update', {
      hostKey: currentRoom,
      clueIndex: selectedClue.id,
      opened: anyAccepted,
      answer: anyAccepted ? selectedClue.answer : undefined,
    });

    setPlayerAnswers((prev) => prev.filter((answer) => answer.clueIndex !== selectedClue.id));
    setSelectedClue(null);
    setSelectedClueRevealed(false);
    if (selectedClue?.id === 4) {
      setKeywordWindowReady(true);
    }
  };

  const startKeywordWindow = (duration = 15) => {
    if (!keywordWindowReady || keywordWindowOpen || !currentRoom) return;

    socket.emit('start-keyword-window', {
      hostKey: currentRoom,
      duration,
    });

    setKeywordWindowOpen(true);
    setKeywordWindowReady(false);
    setKeywordTimeLeft(duration);

    if (keywordTimerRef.current) {
      window.clearInterval(keywordTimerRef.current);
      keywordTimerRef.current = null;
    }
    keywordTimerRef.current = window.setInterval(() => {
      setKeywordTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) {
          if (keywordTimerRef.current) {
            window.clearInterval(keywordTimerRef.current);
            keywordTimerRef.current = null;
          }
          setKeywordWindowOpen(false);
          socket.emit('close-keyword-window', { hostKey: currentRoom });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const acceptKeyword = (attempt: KeywordAttempt, correct: boolean) => {
    socket.emit('keyword-verdict', {
      hostKey: currentRoom,
      targetClientId: attempt.id,
      correct,
      message: correct ? 'You found the keyword! Game over.' : 'Keyword attempt is incorrect.',
    });

    if (correct) {
      let keywordPoints = 60; 
      if (clueCount < 1 || (clueCount == 1 && !selectedClue)) {
        keywordPoints = 60;
      } else if (clueCount < 2 || (clueCount == 2 && !selectedClue)) {
        keywordPoints = 50;
      } else if (clueCount < 3 || (clueCount == 3 && !selectedClue)) {
        keywordPoints = 40;
      } else if (clueCount < 4 || (clueCount == 4 && !selectedClue)) {
        keywordPoints = 30;
      } else {
        keywordPoints = 20;
      }

      socket.emit('award-player-points', {
        hostKey: currentRoom,
        targetClientId: attempt.id,
        points: keywordPoints,
      });
      setPlayerPoints((prev) => {
        return { ...prev, [attempt.id]: (prev[attempt.id] || 0) + keywordPoints };
      });

      triggerMasterRevealSequence();
    } else {
      // FIX ADDITION: Track this user inside the rejection state directory ledger
      setFailedPlayerIds((prev) => ({ ...prev, [attempt.id]: true }));
    }

    setKeywordAttempts((prev) => prev.filter((item) => item.id !== attempt.id || item.time !== attempt.time));
  };

  const triggerMasterRevealSequence = () => {
    setGameWon(true);
    setKeywordWindowOpen(false);
    if (keywordTimerRef.current) window.clearInterval(keywordTimerRef.current);
    
    socket.emit('close-keyword-window', { hostKey: currentRoom });
    socket.emit('reveal-all-clues', {
      hostKey: currentRoom,
      clues: clues.map((clue) => ({ id: clue.id, label: clue.label, question: clue.question, answer: clue.answer })),
    });
  };

  const terminateGame = () => {
    socket.emit('terminate-game', { hostKey: currentRoom });
    setSelectedClue(null);
    setClues((prev) => prev.map((clue) => ({ ...clue, active: false })));
    setPlayerAnswers((prev) => prev.filter((answer) => answer.clueIndex !== selectedClue?.id));
    setSelectedClueRevealed(false);
    navigate('/host');
  };

  const revealQuestion = (duration = 15) => {
    if (!selectedClue || !currentRoom) return;
    socket.emit('reveal-question', {
      hostKey: currentRoom,
      clueIndex: selectedClue.id,
      question: selectedClue.question,
      duration: duration,
      final: selectedClue.id === 4,
    });

    setSelectedClueRevealed(true);
  };

  const startTimer = (duration = 15) => {
    if (!selectedClue || !currentRoom || !selectedClueRevealed) return;
    socket.emit('start-answer-window', {
      hostKey: currentRoom,
      clueIndex: selectedClue.id,
      duration,
    });

    setHostTimeLeft(duration);

    if (hostTimerRef.current) {
      window.clearInterval(hostTimerRef.current);
      hostTimerRef.current = null;
    }
    hostTimerRef.current = window.setInterval(() => {
      setHostTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) {
          if (hostTimerRef.current) {
            window.clearInterval(hostTimerRef.current);
            hostTimerRef.current = null;
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleLeave = () => {
    disconnectSocket();
  };

  if (!isConnected || !currentRoom) {
    return <div style={{ color: '#fff', padding: '20px' }}>Loading Round2 game...</div>;
  }

  return (
    <div style={{ padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Host Round2 Game</h1>
          <p>Room: <span style={{ color: '#4CAF50', fontFamily: 'monospace' }}>{currentRoom}</span></p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={terminateGame} style={{ backgroundColor: '#f4a261', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {gameWon ? 'Finish Game' : 'Terminate Game'}
          </button>
          <button onClick={handleLeave} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            Leave Game
          </button>
        </div>
      </div>

      <hr style={{ borderColor: '#333', margin: '20px 20px 24px' }} />

      <section style={{ margin: '0 0 24px' }}>
        <h2>Choose a clue</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
          {clues.filter((clue) => clue.id !== 4).map((clue) => {
            const isDisabled = gameWon || (selectedClue !== null && selectedClue.id !== clue.id) || (clue.used && !clue.active);
            return (
              <button
                key={clue.id}
                disabled={isDisabled}
                onClick={() => chooseClue(clue)}
                style={{
                  padding: '16px',
                  backgroundColor: clue.active ? '#264653' : clue.used ? '#333' : '#1e1e1e',
                  border: '1px solid #444',
                  borderRadius: '12px',
                  color: '#fff',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                {clue.label}
                <div style={{ marginTop: '8px', color: '#888', fontSize: '0.9rem' }}>
                  {clue.active ? 'Current active clue' : clue.used ? (clue.opened ? 'Opened' : 'Answered') : 'Available'}
                </div>
              </button>
            );
          })}
          {finalClueVisible && (
            <button
              disabled={gameWon || selectedClue !== null || !finalClueReady}
              onClick={chooseFinalClue}
              style={{ padding: '16px', backgroundColor: finalClueReady ? '#2a2a2a' : '#1f1f1f', border: '1px solid #444', borderRadius: '12px', color: '#fff', cursor: gameWon || selectedClue !== null || !finalClueReady ? 'not-allowed' : 'pointer' }}
            >
              Final Clue
              <div style={{ marginTop: '8px', color: '#888', fontSize: '0.9rem' }}>
                {finalClueReady ? (finalClue.used ? 'Selected' : 'Ready') : 'Locked until 4 clues are finalized'}
              </div>
            </button>
          )}
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Current Question</h2>
        {selectedClue ? (
          <div style={{ padding: '18px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px' }}>
            {selectedClueRevealed ? (
              <>
                <p style={{ margin: 0, fontSize: '1.05rem' }}>{selectedClue.question}</p>
                <p style={{ margin: '10px 0 0', color: '#888' }}>Players are now answering this clue.</p>
                {hostTimeLeft !== null && (
                  <p style={{ margin: '6px 0 0', color: '#ffb703' }}>Time left: {hostTimeLeft}s</p>
                )}
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: '1.05rem', color: '#888' }}>Question is hidden. Reveal when ready.</p>
              </>
            )}

            <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
              <button onClick={() => revealQuestion()} disabled={selectedClueRevealed} style={{ backgroundColor: selectedClueRevealed ? '#555' : '#0a84ff', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '8px', cursor: selectedClueRevealed ? 'not-allowed' : 'pointer' }}>
                Reveal Question
              </button>
              <button onClick={() => startTimer(15)} disabled={!selectedClueRevealed || (hostTimeLeft !== null && hostTimeLeft > 0)} style={{ backgroundColor: (!selectedClueRevealed || (hostTimeLeft !== null && hostTimeLeft > 0)) ? '#555' : '#ffb703', color: '#000', border: 'none', padding: '10px 14px', borderRadius: '8px', cursor: (!selectedClueRevealed || (hostTimeLeft !== null && hostTimeLeft > 0)) ? 'not-allowed' : 'pointer' }}>
                Start 15s Timer
              </button>
            </div>

            <div style={{ marginTop: '16px', borderTop: '1px solid #2b2b2b', paddingTop: '12px' }}>
              <h3 style={{ margin: '0 0 8px' }}>Player Answers</h3>
              {(() => {
                const displayedPlayers = connectedClients.map((client) => {
                  const ansIndex = playerAnswers.findIndex((a) => a.id === client.id && (!selectedClue || a.clueIndex === selectedClue.id));
                  const ans = ansIndex >= 0 ? playerAnswers[ansIndex] : null;
                  return {
                    id: client.id,
                    name: client.name,
                    clueIndex: ans ? ans.clueIndex : (selectedClue ? selectedClue.id : -1),
                    answer: ans ? ans.answer : '',
                    time: ans ? ans.time : '',
                    accepted: ans ? ans.accepted : false,
                    answered: !!ans,
                    keywordAttempted: ans ? ans.keywordAttempted : false,
                    originalIndex: ansIndex,
                  };
                });

                if (!displayedPlayers || displayedPlayers.length === 0) {
                  return <p style={{ color: '#888', margin: 0 }}>No players connected.</p>;
                }

                return (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {displayedPlayers.map((p) => (
                      <div key={p.id} style={{ backgroundColor: '#141414', border: '1px solid #2b2b2b', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                          <div>
                            <strong>{p.name}</strong>
                            <div style={{ color: '#888', fontSize: '0.9rem' }}>{p.clueIndex >= 0 ? `for clue ${p.clueIndex + 1}` : 'no clue yet'}{p.time ? ` • ${p.time}` : ''}</div>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc' }}>
                            <input
                              type="checkbox"
                              checked={p.accepted}
                              onChange={() => p.originalIndex >= 0 && toggleAnswerAccepted(p.originalIndex)}
                              style={{ width: '18px', height: '18px' }}
                              disabled={p.originalIndex < 0 || p.keywordAttempted}
                            />
                            <span style={{ fontSize: '0.9rem' }}>Mark as correct</span>
                          </label>
                        </div>
                        <p style={{ margin: '8px 0 0' }}>{p.answer}</p>
                      </div>
                    ))}
                    {selectedClue && (
                      <button
                        onClick={finalizeClueJudgement}
                        disabled={hostTimeLeft !== 0}
                        style={{ backgroundColor: hostTimeLeft === 0 ? '#4CAF50' : '#666', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '8px', cursor: hostTimeLeft === 0 ? 'pointer' : 'not-allowed', marginTop: '8px', alignSelf: 'flex-start' }}
                      >
                        Finalize Clue Outcome
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <p style={{ color: '#aaa' }}>Choose a clue to send the question to players.</p>
        )}
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Player Points</h2>
        {connectedClients.length === 0 ? (
          <p style={{ color: '#888' }}>No players connected.</p>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {connectedClients.map((client) => (
              <div key={client.id} style={{ display: 'grid', gap: '10px', padding: '12px', backgroundColor: '#141414', border: '1px solid #2b2b2b', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <strong>{client.name}</strong>
                    <div style={{ color: '#888', fontSize: '0.9rem' }}>
                      {playerPoints[client.id] || 0} pts
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={manualPoints[client.id] ?? ''}
                      onChange={(e) => handleManualPointsChange(client.id, e.target.value)}
                      placeholder="+/- or set"
                      style={{ width: '100px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#121212', color: '#fff' }}
                    />
                    <button
                      onClick={() => handleAddPlayerPoints(client.id)}
                      style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', cursor: 'pointer' }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => handleSetPlayerPoints(client.id)}
                      style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#FFA000', color: '#fff', border: 'none', cursor: 'pointer' }}
                    >
                      Set
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Keyword Attempts</h2>
        {keywordAttempts.length === 0 ? (
          <p style={{ color: '#888' }}>No keyword attempts yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {keywordAttempts.map((attempt, index) => (
              <div key={`${attempt.id}-${index}`} style={{ padding: '16px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{attempt.name}</strong> attempted the keyword
                  </div>
                  <span style={{ color: '#888' }}>{attempt.time}</span>
                </div>
                <p style={{ margin: '10px 0' }}>{attempt.answer}</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => acceptKeyword(attempt, true)} style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', cursor: 'pointer' }}>
                    Correct
                  </button>
                  <button onClick={() => acceptKeyword(attempt, false)} style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#f44336', color: '#fff', border: 'none', cursor: 'pointer' }}>
                    Incorrect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          {keywordWindowReady && !keywordWindowOpen && !gameWon && (
            <button
              onClick={() => startKeywordWindow(15)}
              style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: '#ff9800', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Start Final Keyword Window
            </button>
          )}

          {/* EMERGENCY REVEAL OVERRIDE BUTTON: Only displays if every connected player has failed an attempt */}
          {haveAllPlayersFailedKeyword && !keywordWindowOpen && !gameWon && (
            <button
              onClick={triggerMasterRevealSequence}
              style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: '#d90429', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 0 10px rgba(217,4,41,0.3)' }}
            >
              🚨 Everyone Failed. Reveal Everything!
            </button>
          )}
        </div>

        {keywordWindowOpen && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#202020', borderRadius: '10px', border: '1px solid #444' }}>
            <p style={{ margin: 0, color: '#fff' }}>Final keyword chance is live.</p>
            <p style={{ margin: '6px 0 0', color: '#ffb703' }}>Time left: {keywordTimeLeft}s</p>
          </div>
        )}
      </section>

      {gameWon && (
        <section style={{ padding: '16px', backgroundColor: '#163a17', border: '1px solid #2e7d32', borderRadius: '10px' }}>
          <h2 style={{ margin: '0 0 10px' }}>Game Over</h2>
          <p>The keyword has been solved and all clues are revealed.</p>
        </section>
      )}
    </div>
  );
}