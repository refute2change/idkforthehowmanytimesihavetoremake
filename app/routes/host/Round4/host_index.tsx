import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../../components/SocketContext';
import { socket } from '../../../socket';

const PROTOTYPE_QUESTION_BANK = {
  40: [
    { points: 10, question: "What is the capital city of France?" },
    { points: 10, question: "How many legs does a spider have?" },
    { points: 20, question: "Which planet is known as the 'Red Planet'?" }
  ],
  60: [
    { points: 10, question: "What gas do plants absorb from the atmosphere during photosynthesis?" },
    { points: 20, question: "Who wrote the famous play 'Romeo and Juliet'?" },
    { points: 30, question: "What is the chemical symbol for the element Gold?" }
  ],
  80: [
    { points: 20, question: "What is the rarest naturally occurring element on Earth?" },
    { points: 30, question: "Which mathematician is credited with creating the coordinate geometry system?" },
    { points: 30, question: "In what year did the Berlin Wall come down?" }
  ]
};

type PackValue = 40 | 60 | 80;

interface PlayerAnswer {
  id: string;
  name: string;
  answer: string;
  time: string;
}

interface StealAttempt {
  id: string;
  name: string;
}

export default function HostRound4() {
  const { isConnected, currentRoom, disconnectSocket, connectedClients } = useSocket();
  const navigate = useNavigate();

  // Core Configuration States
  const [activePlayerId, setActivePlayerId] = useState<string>('');
  const [turnStaged, setTurnStaged] = useState<boolean>(false);
  const [completedPlayerIds, setCompletedPlayerIds] = useState<{ [playerId: string]: boolean }>({});
  const [selectedPack, setSelectedPack] = useState<PackValue | null>(null);
  const [usedSubQuestions, setUsedSubQuestions] = useState<{ [key: number]: boolean }>({ 0: false, 1: false, 2: false });
  const [currentSubQuestionIndex, setCurrentSubQuestionIndex] = useState<number | null>(null);
  const [turnFullyFinished, setTurnFullyFinished] = useState<boolean>(false);

  // Star of Hope Trackers
  const [starOfHopeUsedByPlayer, setStarOfHopeUsedByPlayer] = useState<{ [playerId: string]: boolean }>({});
  const [starOfHopeActiveThisQuestion, setStarOfHopeActiveThisQuestion] = useState<boolean>(false);

  // Live Game Round Tracking States
  const [questionPrompt, setQuestionPrompt] = useState<string>('');
  const [questionSelected, setQuestionSelected] = useState<boolean>(false);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [hostTimeLeft, setHostTimeLeft] = useState<number | null>(null);
  
  // Scoring Assessment & Steal States
  const [playerAnswers, setPlayerAnswers] = useState<PlayerAnswer[]>([]);
  const [stealWindowOpen, setStealWindowOpen] = useState<boolean>(false);
  const [stealTimeLeft, setStealTimeLeft] = useState<number | null>(null);
  const [currentStealAttempt, setCurrentStealAttempt] = useState<StealAttempt | null>(null);

  const [playerPoints, setPlayerPoints] = useState<{ [playerId: string]: number }>({});
  const [manualPoints, setManualPoints] = useState<{ [playerId: string]: string }>({});
  
  const mainTimerRef = useRef<number | null>(null);
  const stealTimerRef = useRef<number | null>(null);

  // Evaluates if every single connected player client has finished their pack turn run
  const areAllPlayersFinished = useMemo(() => {
    if (connectedClients.length === 0) return false;
    return connectedClients.every(client => completedPlayerIds[client.id] === true);
  }, [connectedClients, completedPlayerIds]);

  // Derive points and dynamic answer duration for current sub-question
  const currentSubQuestionPoints = useMemo(() => {
    if (selectedPack === null || currentSubQuestionIndex === null) return 0;
    return PROTOTYPE_QUESTION_BANK[selectedPack][currentSubQuestionIndex].points;
  }, [selectedPack, currentSubQuestionIndex]);

  const dynamicDuration = useMemo(() => {
    if (currentSubQuestionPoints === 10) return 10;
    if (currentSubQuestionPoints === 20) return 15;
    if (currentSubQuestionPoints === 30) return 20;
    return 15;
  }, [currentSubQuestionPoints]);

  useEffect(() => {
    if (!isConnected || !currentRoom) {
      navigate('/');
    }
  }, [isConnected, currentRoom, navigate]);

  // WebSocket Event Handlers
  useEffect(() => {
    if (!isConnected) return;

    const handleRound4Answer = (data: any) => {
      setPlayerAnswers((prev) => [
        {
          id: data.senderId,
          name: data.senderName || `Player ${data.senderId.slice(0, 6)}`,
          answer: data.answer,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    };

    const handleStealAttempt = (data: any) => {
      setCurrentStealAttempt((current) => {
        if (current !== null) return current;
        
        if (stealTimerRef.current) {
          window.clearInterval(stealTimerRef.current);
          stealTimerRef.current = null;
        }

        socket.emit('round4-steal-first', {
          hostKey: currentRoom,
          playerId: data.playerId,
          playerName: data.playerName
        });

        return { id: data.playerId, name: data.playerName };
      });
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
    socket.on('round4-steal-first', handleStealAttempt);
    socket.on('player-points-response', handlePlayerPointsResponse);
    socket.on('player-points-awarded', handlePlayerPointsAwarded);

    const handleRegisterPing = () => {
      connectedClients.forEach((client) => {
        socket.emit('request-player-points', { hostKey: currentRoom, targetClientId: client.id });
      });
    };
    socket.on('client-roster-request', handleRegisterPing);

    return () => {
      socket.off('round4-answer', handleRound4Answer);
      socket.off('round4-steal-first', handleStealAttempt);
      socket.off('player-points-response', handlePlayerPointsResponse);
      socket.off('player-points-awarded', handlePlayerPointsAwarded);
      socket.off('client-roster-request', handleRegisterPing);
    };
  }, [isConnected, currentRoom, connectedClients]);

  useEffect(() => {
    if (!isConnected || connectedClients.length === 0 || !currentRoom) return;
    connectedClients.forEach((client) => {
      socket.emit('request-player-points', { hostKey: currentRoom, targetClientId: client.id });
    });
  }, [isConnected, connectedClients, currentRoom]);

  const selectActivePlayerTurn = (playerId: string) => {
    if (completedPlayerIds[playerId] || turnStaged) return;
    setActivePlayerId(playerId);
    setTurnStaged(false);
    setSelectedPack(null);
    setCurrentSubQuestionIndex(null);
    setUsedSubQuestions({ 0: false, 1: false, 2: false });
    setTurnFullyFinished(false);
    setStarOfHopeActiveThisQuestion(false);
  };

  const handleStagePlayerTurn = () => {
    if (!activePlayerId) return;
    setTurnStaged(true);
    socket.emit('round4-stage-turn', {
      hostKey: currentRoom,
      activePlayerId,
      activePlayerName: connectedClients.find(c => c.id === activePlayerId)?.name || 'Player'
    });
  };

  const selectPack = (pack: PackValue) => {
    if (!turnStaged) return;
    setSelectedPack(pack);
    setCurrentSubQuestionIndex(null);
    setUsedSubQuestions({ 0: false, 1: false, 2: false });

    socket.emit('reveal-question', {
      hostKey: currentRoom,
      clueIndex: pack,
      question: 'pack-chosen'
    });
  };

  const handleTriggerStarOfHopePreQuestion = () => {
    if (!activePlayerId || starOfHopeUsedByPlayer[activePlayerId] || questionSelected) return;
    setStarOfHopeActiveThisQuestion(true);
    
    socket.emit('reveal-question', {
      hostKey: currentRoom,
      clueIndex: 777,
      question: 'star-hope-activated'
    });
  };

  const selectSubQuestion = (index: number) => {
    if (selectedPack === null || !activePlayerId || questionSelected) return;

    const targetQuestion = PROTOTYPE_QUESTION_BANK[selectedPack][index];
    setCurrentSubQuestionIndex(index);
    setQuestionPrompt(targetQuestion.question);
    setQuestionSelected(true);
    setTimerRunning(false);
    setPlayerAnswers([]);
    setCurrentStealAttempt(null);
    setStealWindowOpen(false);
    
    setUsedSubQuestions(prev => ({ ...prev, [index]: true }));

    socket.emit('round4-start-question', {
      hostKey: currentRoom,
      question: targetQuestion.question,
      value: targetQuestion.points,
      activePlayerId,
      activePlayerName: connectedClients.find(c => c.id === activePlayerId)?.name || 'Active Player',
      duration: dynamicDuration,
      star: starOfHopeActiveThisQuestion
    });
  };

  const startQuestionTimer = () => {
    if (!questionSelected || timerRunning) return;
    setTimerRunning(true);
    setHostTimeLeft(dynamicDuration);

    if (mainTimerRef.current) window.clearInterval(mainTimerRef.current);
    mainTimerRef.current = window.setInterval(() => {
      setHostTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) {
          if (mainTimerRef.current) window.clearInterval(mainTimerRef.current);
          setTimerRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const markVerdictCorrect = () => {
    if (selectedPack === null || currentSubQuestionIndex === null || stealWindowOpen) return;

    const awardPoints = starOfHopeActiveThisQuestion ? (currentSubQuestionPoints * 2) : currentSubQuestionPoints;

    socket.emit('round4-answer-verdict', {
      hostKey: currentRoom,
      targetClientId: activePlayerId,
      correct: true,
      message: starOfHopeActiveThisQuestion 
        ? `⭐ Star of Hope Success! You earned double: +${awardPoints} points.` 
        : `Correct! You earned +${awardPoints} points.`,
      points: awardPoints
    });

    if (starOfHopeActiveThisQuestion) {
      setStarOfHopeUsedByPlayer((prev) => ({ ...prev, [activePlayerId]: true }));
    }

    setPlayerPoints((prev) => ({ ...prev, [activePlayerId]: (prev[activePlayerId] || 0) + awardPoints }));
    cleanupRoundWorkflow();
  };

  const markVerdictIncorrect = () => {
    if (selectedPack === null || currentSubQuestionIndex === null || stealWindowOpen) return;

    let updatedActivePoints = playerPoints[activePlayerId] || 0;
    if (starOfHopeActiveThisQuestion) {
      setStarOfHopeUsedByPlayer((prev) => ({ ...prev, [activePlayerId]: true }));
      updatedActivePoints = Math.max(0, updatedActivePoints - currentSubQuestionPoints);
      
      socket.emit('adjust-player-points', {
        hostKey: currentRoom,
        targetClientId: activePlayerId,
        points: updatedActivePoints,
        operation: 'set'
      });
      setPlayerPoints((prev) => ({ ...prev, [activePlayerId]: updatedActivePoints }));
    }

    socket.emit('round4-answer-verdict', {
      hostKey: currentRoom,
      targetClientId: activePlayerId,
      correct: false,
      message: 'Incorrect answer. Steal window is now open!',
      points: 0
    });

    setStealWindowOpen(true);
    setStealTimeLeft(5);
    socket.emit('round4-open-steal-window', { hostKey: currentRoom });

    if (stealTimerRef.current) window.clearInterval(stealTimerRef.current);
    stealTimerRef.current = window.setInterval(() => {
      setStealTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) {
          if (stealTimerRef.current) window.clearInterval(stealTimerRef.current);
          setStealWindowOpen(false);
          socket.emit('round4-close-steal-window', { hostKey: currentRoom });
          cleanupRoundWorkflow();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleStealVerdictCorrect = () => {
    if (!currentStealAttempt || selectedPack === null) return;

    socket.emit('round4-steal-verdict', {
      hostKey: currentRoom,
      targetClientId: currentStealAttempt.id,
      correct: true,
      message: `Steal Successful! You earned +${currentSubQuestionPoints} points.`,
      points: currentSubQuestionPoints
    });
    
    const currentActivePoints = playerPoints[activePlayerId] || 0;
    const activeNewPoints = Math.max(0, currentActivePoints - currentSubQuestionPoints);

    socket.emit('adjust-player-points', {
      hostKey: currentRoom,
      targetClientId: activePlayerId,
      points: activeNewPoints,
      operation: 'set'
    });

    setPlayerPoints((prev) => ({
      ...prev,
      [currentStealAttempt.id]: (prev[currentStealAttempt.id] || 0) + currentSubQuestionPoints,
      [activePlayerId]: activeNewPoints
    }));

    cleanupRoundWorkflow();
  };

  const handleStealVerdictIncorrect = () => {
    if (!currentStealAttempt || selectedPack === null) return;
    const penaltyPoints = Math.floor(currentSubQuestionPoints / 2);

    socket.emit('round4-steal-verdict', {
      hostKey: currentRoom,
      targetClientId: currentStealAttempt.id,
      correct: false,
      message: `Steal Failed. You lost -${penaltyPoints} points.`,
      points: 0
    });

    const stealerCurrentPoints = playerPoints[currentStealAttempt.id] || 0;
    const stealerNewPoints = Math.max(0, stealerCurrentPoints - penaltyPoints);

    socket.emit('adjust-player-points', {
      hostKey: currentRoom,
      targetClientId: currentStealAttempt.id,
      points: stealerNewPoints,
      operation: 'set'
    });

    setPlayerPoints((prev) => ({
      ...prev,
      [currentStealAttempt.id]: stealerNewPoints
    }));

    cleanupRoundWorkflow();
  };

  const executeGameTermination = () => {
    socket.emit('terminate-game', { hostKey: currentRoom });
    navigate('/host');
  };

  const handleMasterMorphButtonClick = () => {
    if (areAllPlayersFinished) {
      executeGameTermination();
    } else {
      if (!activePlayerId) return;
      setCompletedPlayerIds(prev => ({ ...prev, [activePlayerId]: true }));
      setActivePlayerId('');
      setTurnStaged(false);
      setSelectedPack(null);
      setCurrentSubQuestionIndex(null);
      setTurnFullyFinished(false);
      setStarOfHopeActiveThisQuestion(false);

      socket.emit('round4-turn-over', { hostKey: currentRoom });
    }
  };

  const cleanupRoundWorkflow = () => {
    if (mainTimerRef.current) window.clearInterval(mainTimerRef.current);
    if (stealTimerRef.current) window.clearInterval(stealTimerRef.current);
    
    setQuestionSelected(false);
    setTimerRunning(false);
    setHostTimeLeft(null);
    setStealWindowOpen(false);
    setStealTimeLeft(null);
    setCurrentStealAttempt(null);
    setPlayerAnswers([]);
    setStarOfHopeActiveThisQuestion(false); 

    const allUsed = Object.values({ ...usedSubQuestions, [currentSubQuestionIndex!]: true }).every(v => v === true);
    if (allUsed) {
      setTurnFullyFinished(true);
    }
  };

  const adjustPlayerPoints = (playerId: string, value: number, operation: 'set' | 'add') => {
    if (!currentRoom) return;
    const current = playerPoints[playerId] || 0;
    const targetValue = operation === 'set' ? value : current + value;
    const finalCleanValue = Math.max(0, targetValue); 

    socket.emit('adjust-player-points', { hostKey: currentRoom, targetClientId: playerId, points: finalCleanValue, operation: 'set' });
    setPlayerPoints((prev) => ({ ...prev, [playerId]: finalCleanValue }));
  };

  return (
    <div style={{ padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Host Round 4 Dashboard</h1>
          <p>Room Identifier Code: <span style={{ color: '#4CAF50', fontFamily: 'monospace' }}>{currentRoom}</span></p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {!areAllPlayersFinished && (
            <button 
              onClick={executeGameTermination} 
              style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🛑 Terminate Game
            </button>
          )}

          <button 
            onClick={handleMasterMorphButtonClick} 
            style={{ 
              backgroundColor: areAllPlayersFinished ? '#36f46f' : '#f4a261', 
              color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer',
              fontWeight: 'bold', boxShadow: areAllPlayersFinished ? '0 0 15px rgba(244,67,54,0.4)' : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            {areAllPlayersFinished ? '🟢 Finish Game' : 'Reset Turn Standby'}
          </button>
          
          <button onClick={disconnectSocket} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>Leave Game</button>
          {/* Top Navbar Action Button: Disappears completely when everyone finishes their turn */}
        </div>
      </div>

      <hr style={{ borderColor: '#333', margin: '20px 0' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '20px' }}>
        <div>
          {/* Step 1 Matrix Selector */}
          <section style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#1c1c1c', borderRadius: '8px' }}>
            <h2>Step 1: Active Turn Matrix</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
              {connectedClients.map((client) => {
                const isFinished = completedPlayerIds[client.id];
                const isCurrent = activePlayerId === client.id;
                return (
                  <button
                    key={client.id}
                    disabled={isFinished || turnStaged || (activePlayerId !== '' && !isCurrent)}
                    onClick={() => selectActivePlayerTurn(client.id)}
                    style={{
                      padding: '12px 18px', borderRadius: '6px', border: 'none', fontWeight: 'bold',
                      cursor: (isFinished || turnStaged || (activePlayerId !== '' && !isCurrent)) ? 'not-allowed' : 'pointer',
                      backgroundColor: isCurrent ? '#4CAF50' : isFinished ? '#222' : '#333',
                      color: isFinished ? '#555' : '#fff'
                    }}
                  >
                    {client.name} {isFinished ? '[DONE]' : isCurrent ? '[ACTIVE]' : '[READY]'}
                  </button>
                );
              })}
            </div>

            {activePlayerId && !turnStaged && (
              <button
                onClick={handleStagePlayerTurn}
                style={{ width: '100%', padding: '14px', backgroundColor: '#8E24AA', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' }}
              >
                🚀 Stage Player Turn
              </button>
            )}
          </section>

          {/* Step 2 Pack selection */}
          {turnStaged && (
            <section style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#1c1c1c', borderRadius: '8px' }}>
              <h2>Step 2: Choose Point Pack</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                {([40, 60, 80] as PackValue[]).map((pack) => {
                  const isSelected = selectedPack === pack;
                  return (
                    <button
                      key={pack}
                      disabled={questionSelected || turnFullyFinished}
                      onClick={() => selectPack(pack)}
                      style={{
                        flex: 1, padding: '14px', fontSize: '1.1rem', borderRadius: '6px', border: 'none',
                        cursor: (questionSelected || turnFullyFinished) ? 'not-allowed' : 'pointer',
                        backgroundColor: isSelected ? '#1fc7d4' : '#2b2b2b',
                        color: isSelected ? '#000' : '#fff', fontWeight: 'bold'
                      }}
                    >
                      {pack} pts
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Step 3 Question Pool Matrix */}
          {selectedPack !== null && (
            <section style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#1c1c1c', borderRadius: '8px' }}>
              <h2>Step 3: Questions Pool</h2>
              
              {!questionSelected && (
                <button
                  disabled={starOfHopeUsedByPlayer[activePlayerId] || starOfHopeActiveThisQuestion}
                  onClick={handleTriggerStarOfHopePreQuestion}
                  style={{
                    width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '6px', border: 'none', fontWeight: 'bold',
                    cursor: (starOfHopeUsedByPlayer[activePlayerId] || starOfHopeActiveThisQuestion) ? 'not-allowed' : 'pointer',
                    backgroundColor: starOfHopeActiveThisQuestion ? '#4CAF50' : starOfHopeUsedByPlayer[activePlayerId] ? '#222' : '#ffb703',
                    color: starOfHopeUsedByPlayer[activePlayerId] ? '#555' : '#000'
                  }}
                >
                  {starOfHopeActiveThisQuestion ? '🌟 Star of Hope Pre-Activated!' : starOfHopeUsedByPlayer[activePlayerId] ? '🌟 Star of Hope Already Used' : '🌟 Click to Activate Star of Hope (Pre-Question)'}
                </button>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                {PROTOTYPE_QUESTION_BANK[selectedPack].map((item, idx) => {
                  const wasFired = usedSubQuestions[idx];
                  return (
                    <button
                      key={idx}
                      disabled={wasFired || questionSelected}
                      onClick={() => selectSubQuestion(idx)}
                      style={{
                        flex: 1, padding: '16px', borderRadius: '6px', border: 'none',
                        cursor: (wasFired || questionSelected) ? 'not-allowed' : 'pointer',
                        backgroundColor: currentSubQuestionIndex === idx ? '#4CAF50' : wasFired ? '#222' : '#ffa000',
                        color: wasFired ? '#555' : '#fff', fontWeight: 'bold'
                      }}
                    >
                      Q{idx + 1} ({item.points} pts)
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Turn Fully Finished Overlay Block */}
          {turnFullyFinished && (
            <section style={{ marginTop: '20px', padding: '16px', backgroundColor: '#102012', border: '1px solid #2e7d32', borderRadius: '8px' }}>
              <button
                onClick={handleMasterMorphButtonClick}
                style={{ 
                  width: '100%', padding: '14px', 
                  backgroundColor: areAllPlayersFinished ? '#f44336' : '#4CAF50', 
                  border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' 
                }}
              >
                {areAllPlayersFinished ? '🛑 All Turns Finished! Click to Terminate Game' : '🏁 Close Turn (Clear Clients to Standby)'}
              </button>
            </section>
          )}
        </div>

        {/* Assessment Evaluation Control Desk Block */}
        <div>
          {questionSelected && (
            <section style={{ padding: '16px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Operational Desk {starOfHopeActiveThisQuestion && <span style={{ color: '#ffb703' }}>(⭐ STAR ACTIVE)</span>}</h3>
                {!timerRunning && hostTimeLeft === null && (
                  <button 
                    onClick={() => {
                      startQuestionTimer();
                      socket.emit('round4-start-timer', { hostKey: currentRoom, duration: dynamicDuration });
                    }} 
                    style={{ backgroundColor: '#ffb703', color: '#000', border: 'none', padding: '8px 16px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Start {dynamicDuration}s Timer
                  </button>
                )}
                {hostTimeLeft !== null && (
                  <span style={{ backgroundColor: timerRunning ? '#2a9d8f' : '#f44336', padding: '4px 10px', borderRadius: '4px', fontWeight: 'bold' }}>
                    Timer: {hostTimeLeft}s
                  </span>
                )}
              </div>

              <div style={{ margin: '15px 0', padding: '12px', backgroundColor: '#111', borderRadius: '4px', borderLeft: '4px solid #ffa000' }}>
                <p style={{ margin: 0, fontSize: '1rem' }}>{questionPrompt}</p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4>Response Channels:</h4>
                {playerAnswers.map((ans, idx) => (
                  <div key={idx} style={{ padding: '10px', backgroundColor: '#222', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><strong>{ans.name}:</strong> {ans.answer}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        disabled={stealWindowOpen} 
                        onClick={markVerdictCorrect} 
                        style={{ backgroundColor: stealWindowOpen ? '#333' : '#4CAF50', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: stealWindowOpen ? 'not-allowed' : 'pointer' }}
                      >
                        Correct
                      </button>
                      <button 
                        disabled={stealWindowOpen} 
                        onClick={markVerdictIncorrect} 
                        style={{ backgroundColor: stealWindowOpen ? '#333' : '#f44336', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: stealWindowOpen ? 'not-allowed' : 'pointer' }}
                      >
                        Incorrect
                      </button>
                    </div>
                  </div>
                ))}
                
                {playerAnswers.length === 0 && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button 
                      disabled={stealWindowOpen} 
                      onClick={markVerdictCorrect} 
                      style={{ flex: 1, padding: '10px', backgroundColor: stealWindowOpen ? '#333' : '#4CAF50', border: 'none', color: '#fff', borderRadius: '4px', cursor: stealWindowOpen ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                    >
                      Force Pass Correct
                    </button>
                    <button 
                      disabled={stealWindowOpen} 
                      onClick={markVerdictIncorrect} 
                      style={{ flex: 1, padding: '10px', backgroundColor: stealWindowOpen ? '#333' : '#f44336', border: 'none', color: '#fff', borderRadius: '4px', cursor: stealWindowOpen ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                    >
                      Force Pass Incorrect
                    </button>
                  </div>
                )}
              </div>

              {stealWindowOpen && (
                <div style={{ padding: '14px', backgroundColor: '#2b1b3d', border: '1px solid #7b2cbf', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, color: '#e0aaff' }}>Steal Buzz Active (Main Actions Inactive)</h4>
                    {stealTimeLeft !== null && <span style={{ color: '#ffb703', fontWeight: 'bold' }}>{stealTimeLeft}s</span>}
                  </div>

                  {currentStealAttempt ? (
                    <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#1a0f29', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>{currentStealAttempt.name}</strong> buzzed!</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleStealVerdictCorrect} style={{ backgroundColor: '#4CAF50', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Accept (+{currentSubQuestionPoints})</button>
                        <button onClick={handleStealVerdictIncorrect} style={{ backgroundColor: '#f44336', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Deny</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: '10px 0 0', fontStyle: 'italic', color: '#b5838d' }}>Awaiting buzzer click...</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Realtime Score Matrix */}
          <section style={{ padding: '16px', backgroundColor: '#1c1c1c', borderRadius: '8px' }}>
            <h2>Realtime Score Matrix</h2>
            {connectedClients.map((client) => (
              <div key={client.id} style={{ display: 'grid', gap: '8px', padding: '12px 0', borderBottom: '1px solid #333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  options: <strong>{client.name} {client.id === activePlayerId ? <span style={{ color: '#ffa000', fontSize: '0.8rem' }}>[ACTIVE]</span> : ''}</strong>
                  <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{playerPoints[client.id] || 0} pts</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    value={manualPoints[client.id] ?? ''}
                    onChange={(e) => setManualPoints({ ...manualPoints, [client.id]: e.target.value })}
                    placeholder="Delta"
                    style={{ flex: 1, padding: '8px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                  />
                  <button onClick={() => adjustPlayerPoints(client.id, Number(manualPoints[client.id]), 'add')} style={{ backgroundColor: '#264653', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px' }}>Add</button>
                  <button onClick={() => adjustPlayerPoints(client.id, Number(manualPoints[client.id]), 'set')} style={{ backgroundColor: '#e76f51', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px' }}>Set</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}