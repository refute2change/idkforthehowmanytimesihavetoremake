// app/routes/host/Round4/host_index.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../../components/SocketContext';
import { socket } from '../../../socket';
import { GameHeader } from '../../../components/GameHeader';

const PROTOTYPE_QUESTION_BANK = {
  40: [{ points: 10, question: "What is the capital city of France?" }, { points: 10, question: "How many legs does a spider have?" }, { points: 20, question: "Which planet is known as the 'Red Planet'?" }],
  60: [{ points: 10, question: "What gas do plants absorb from the atmosphere during photosynthesis?" }, { points: 20, question: "Who wrote the famous play 'Romeo and Juliet'?" }, { points: 30, question: "What is the chemical symbol for the element Gold?" }],
  80: [{ points: 20, question: "What is the rarest naturally occurring element on Earth?" }, { points: 30, question: "Which mathematician is credited with creating the coordinate geometry system?" }, { points: 30, question: "In what year did the Berlin Wall come down?" }]
};

type PackValue = 40 | 60 | 80;
interface PlayerAnswer { id: string; name: string; answer: string; time: string; }
interface StealAttempt { id: string; name: string; }

export default function HostRound4() {
  const { isConnected, currentRoom, connectedClients } = useSocket();
  const navigate = useNavigate();

  const [activePlayerId, setActivePlayerId] = useState<string>('');
  const [turnStaged, setTurnStaged] = useState<boolean>(false);
  const [completedPlayerIds, setCompletedPlayerIds] = useState<{ [playerId: string]: boolean }>({});
  const [selectedPack, setSelectedPack] = useState<PackValue | null>(null);
  const [usedSubQuestions, setUsedSubQuestions] = useState<{ [key: number]: boolean }>({ 0: false, 1: false, 2: false });
  const [currentSubQuestionIndex, setCurrentSubQuestionIndex] = useState<number | null>(null);
  const [turnFullyFinished, setTurnFullyFinished] = useState<boolean>(false);
  const [starOfHopeUsedByPlayer, setStarOfHopeUsedByPlayer] = useState<{ [playerId: string]: boolean }>({});
  const [starOfHopeActiveThisQuestion, setStarOfHopeActiveThisQuestion] = useState<boolean>(false);

  const [questionPrompt, setQuestionPrompt] = useState<string>('');
  const [questionSelected, setQuestionSelected] = useState<boolean>(false);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [hostTimeLeft, setHostTimeLeft] = useState<number | null>(null);
  
  const [playerAnswers, setPlayerAnswers] = useState<PlayerAnswer[]>([]);
  const [stealWindowOpen, setStealWindowOpen] = useState<boolean>(false);
  const [stealTimeLeft, setStealTimeLeft] = useState<number | null>(null);
  const [currentStealAttempt, setCurrentStealAttempt] = useState<StealAttempt | null>(null);
  const [playerPoints, setPlayerPoints] = useState<{ [playerId: string]: number }>({});
  const [manualPoints, setManualPoints] = useState<{ [playerId: string]: string }>({});
  
  const mainTimerRef = useRef<number | null>(null);
  const stealTimerRef = useRef<number | null>(null);

  const styles = {
    wrapper: { padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh', fontFamily: 'sans-serif' },
    card: { marginBottom: '20px', padding: '16px', backgroundColor: '#1c1c1c', borderRadius: '8px' },
    gridRow: { display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '20px' },
    scoreInput: { flex: 1, padding: '8px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' },
    terminateButton: { backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
    masterMorphButton: (active: boolean) => ({ backgroundColor: active ? '#36f46f' : '#f4a261', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }),
    playerButton: (completed: boolean, isActive: boolean) => ({ padding: '12px 18px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: completed ? 'not-allowed' : 'pointer', backgroundColor: isActive ? '#4CAF50' : completed ? '#222' : '#333', color: completed ? '#555' : '#fff' }),
    stageButton: { width: '100%', padding: '14px', backgroundColor: '#8E24AA', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' },
    choosePack: (selected: boolean) => ({ flex: 1, padding: '14px', fontSize: '1.1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: selected ? '#1fc7d4' : '#2b2b2b', color: '#fff', fontWeight: 'bold' }),
    starActivation: (thisQuestionActive: boolean, starOfHopeUsed: boolean, turnFinished: boolean) => ({
      width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '6px', border: 'none', fontWeight: 'bold', 
      backgroundColor: thisQuestionActive ? '#4CAF50' : starOfHopeUsed || turnFinished ? '#222' : '#ffb703',
      color: starOfHopeUsed || turnFinished ? '#555' : '#000', cursor: (starOfHopeUsed || thisQuestionActive || turnFinished) ? 'not-allowed' : 'pointer'
    }),
    nextQuestionButton: (isStaged: boolean) => ({
      width: '100%', padding: '16px', borderRadius: '6px', border: 'none', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff',
      backgroundColor: isStaged ? '#222' : '#ffa000', boxShadow: !isStaged ? '0 4px 12px rgba(255, 160, 0, 0.2)' : 'none', cursor: isStaged ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
    }),
    finishTurnSection: { marginTop: '20px', padding: '16px', backgroundColor: '#102012', border: '1px solid #2e7d32', borderRadius: '8px' },
    finishTurnButton: { width: '100%', padding: '14px', backgroundColor: '#4CAF50', border: 'none', color: '#222', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' },
    operationalDesk: { padding: '16px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '8px', marginBottom: '20px' },
    deskHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    timerBtn: { backgroundColor: '#ffb703', color: '#000', border: 'none', padding: '8px 16px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' },
    timerDisplay: { backgroundColor: '#f44336', padding: '4px 10px', borderRadius: '4px', fontWeight: 'bold' },
    promptBox: { margin: '15px 0', padding: '12px', backgroundColor: '#111', borderRadius: '4px', borderLeft: '4px solid #ffa000' },
    answerItem: { padding: '10px', backgroundColor: '#222', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    stealPanel: { padding: '14px', backgroundColor: '#2b1b3d', border: '1px solid #7b2cbf', borderRadius: '6px' },
    stealHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    scoreMatrixItem: { display: 'grid', gap: '8px', padding: '12px 0', borderBottom: '1px solid #333' }
  };

  const areAllPlayersFinished = useMemo(() => connectedClients.length > 0 && connectedClients.every(c => completedPlayerIds[c.id] === true), [connectedClients, completedPlayerIds]);
  const currentSubQuestionPoints = useMemo(() => (selectedPack !== null && currentSubQuestionIndex !== null) ? PROTOTYPE_QUESTION_BANK[selectedPack][currentSubQuestionIndex].points : 0, [selectedPack, currentSubQuestionIndex]);
  const dynamicDuration = useMemo(() => currentSubQuestionPoints === 10 ? 10 : currentSubQuestionPoints === 20 ? 15 : 20, [currentSubQuestionPoints]);

  useEffect(() => {
    if (!isConnected || !currentRoom) navigate('/');
  }, [isConnected, currentRoom, navigate]);

  useEffect(() => {
    if (!isConnected) return;

    socket.on('round4-answer', (d) => setPlayerAnswers((prev) => [{ id: d.senderId, name: d.senderName || `Player ${d.senderId.slice(0, 6)}`, answer: d.answer, time: new Date().toLocaleTimeString() }, ...prev]));
    socket.on('round4-steal-first', (d) => setCurrentStealAttempt((current) => { if (current !== null) return current; if (stealTimerRef.current) { window.clearInterval(stealTimerRef.current); stealTimerRef.current = null; } socket.emit('round4-steal-first', { hostKey: currentRoom, playerId: d.playerId, playerName: d.playerName }); return { id: d.playerId, name: d.playerName }; }));
    socket.on('player-points-response', (d) => d.playerId && setPlayerPoints((prev) => ({ ...prev, [d.playerId]: d.points })));
    socket.on('player-points-awarded', (d) => d.playerId && setPlayerPoints((prev) => ({ ...prev, [d.playerId]: d.points })));
    socket.on('client-roster-request', () => connectedClients.forEach((c) => socket.emit('request-player-points', { hostKey: currentRoom, targetClientId: c.id })));

    return () => {
      socket.off('round4-answer'); socket.off('round4-steal-first'); socket.off('player-points-response'); socket.off('player-points-awarded'); socket.off('client-roster-request');
    };
  }, [isConnected, currentRoom, connectedClients]);

  useEffect(() => {
    if (isConnected && currentRoom) connectedClients.forEach((c) => socket.emit('request-player-points', { hostKey: currentRoom, targetClientId: c.id }));
  }, [isConnected, connectedClients, currentRoom]);

  const selectActivePlayerTurn = (playerId: string) => {
    if (completedPlayerIds[playerId] || turnStaged) return;
    setActivePlayerId(playerId); setTurnStaged(false); setSelectedPack(null); setCurrentSubQuestionIndex(null);
    setUsedSubQuestions({ 0: false, 1: false, 2: false }); setTurnFullyFinished(false); setStarOfHopeActiveThisQuestion(false);
  };

  const handleStagePlayerTurn = () => {
    if (!activePlayerId) return;
    setTurnStaged(true);
    socket.emit('round4-stage-turn', { hostKey: currentRoom, activePlayerId, activePlayerName: connectedClients.find(c => c.id === activePlayerId)?.name || 'Player' });
  };

  const selectPack = (pack: PackValue) => {
    if (!turnStaged) return;
    setSelectedPack(pack); setCurrentSubQuestionIndex(null); setUsedSubQuestions({ 0: false, 1: false, 2: false });
    socket.emit('reveal-question', { hostKey: currentRoom, clueIndex: pack, question: 'pack-chosen' });
  };

  const handleTriggerStarOfHopePreQuestion = () => {
    if (!activePlayerId || starOfHopeUsedByPlayer[activePlayerId] || questionSelected || turnFullyFinished) return;
    setStarOfHopeActiveThisQuestion(true);
    setStarOfHopeUsedByPlayer((prev) => ({
      ...prev,
      [activePlayerId]: true
    }));
    socket.emit('reveal-question', { hostKey: currentRoom, clueIndex: 777, question: 'star-hope-activated' });
  };

  const selectSubQuestion = (index: number) => {
    if (selectedPack === null || !activePlayerId || questionSelected) return;
    const target = PROTOTYPE_QUESTION_BANK[selectedPack][index];
    setCurrentSubQuestionIndex(index); setQuestionPrompt(target.question); setQuestionSelected(true);
    setTimerRunning(false); setPlayerAnswers([]); setCurrentStealAttempt(null); setStealWindowOpen(false);
    setUsedSubQuestions(prev => ({ ...prev, [index]: true }));
    socket.emit('round4-start-question', { hostKey: currentRoom, question: target.question, value: target.points, activePlayerId, activePlayerName: connectedClients.find(c => c.id === activePlayerId)?.name || 'Active Player', duration: dynamicDuration, star: starOfHopeActiveThisQuestion });
  };

  const startQuestionTimer = () => {
    if (!questionSelected || timerRunning) return;
    setTimerRunning(true); setHostTimeLeft(dynamicDuration);
    if (mainTimerRef.current) window.clearInterval(mainTimerRef.current);
    mainTimerRef.current = window.setInterval(() => {
      setHostTimeLeft((t) => { if (t === null) return null; if (t <= 1) { window.clearInterval(mainTimerRef.current!); setTimerRunning(false); return 0; } return t - 1; });
    }, 1000);
  };

  const markVerdictCorrect = () => {
    if (selectedPack === null || currentSubQuestionIndex === null || stealWindowOpen) return;
    const awardPoints = starOfHopeActiveThisQuestion ? (currentSubQuestionPoints * 2) : currentSubQuestionPoints;
    socket.emit('round4-answer-verdict', { hostKey: currentRoom, targetClientId: activePlayerId, correct: true, message: starOfHopeActiveThisQuestion ? `⭐ Double Points: +${awardPoints}` : `Correct: +${awardPoints}`, points: awardPoints });
    if (starOfHopeActiveThisQuestion) setStarOfHopeUsedByPlayer((prev) => ({ ...prev, [activePlayerId]: true }));
    setPlayerPoints((prev) => ({ ...prev, [activePlayerId]: (prev[activePlayerId] || 0) + awardPoints }));
    cleanupRoundWorkflow();
  };

  const markVerdictIncorrect = () => {
    if (selectedPack === null || currentSubQuestionIndex === null || stealWindowOpen) return;
    let updatedActivePoints = playerPoints[activePlayerId] || 0;
    if (starOfHopeActiveThisQuestion) {
      setStarOfHopeUsedByPlayer((prev) => ({ ...prev, [activePlayerId]: true }));
      updatedActivePoints = Math.max(0, updatedActivePoints - currentSubQuestionPoints);
      socket.emit('adjust-player-points', { hostKey: currentRoom, targetClientId: activePlayerId, points: updatedActivePoints, operation: 'set' });
      setPlayerPoints((prev) => ({ ...prev, [activePlayerId]: updatedActivePoints }));
    }
    socket.emit('round4-answer-verdict', { hostKey: currentRoom, targetClientId: activePlayerId, correct: false, message: 'Incorrect answer. Steal window open!', points: 0 });
    setStealWindowOpen(true); setStealTimeLeft(5); socket.emit('round4-open-steal-window', { hostKey: currentRoom });

    if (stealTimerRef.current) window.clearInterval(stealTimerRef.current);
    stealTimerRef.current = window.setInterval(() => {
      setStealTimeLeft((t) => { if (t === null) return null; if (t <= 1) { window.clearInterval(stealTimerRef.current!); setStealWindowOpen(false); socket.emit('round4-close-steal-window', { hostKey: currentRoom }); cleanupRoundWorkflow(); return 0; } return t - 1; });
    }, 1000);
  };

  const handleStealVerdictCorrect = () => {
    if (!currentStealAttempt || selectedPack === null) return;
    socket.emit('round4-steal-verdict', { hostKey: currentRoom, targetClientId: currentStealAttempt.id, correct: true, message: `Steal Success: +${currentSubQuestionPoints}`, points: currentSubQuestionPoints });
    const currentActivePoints = playerPoints[activePlayerId] || 0;
    const activeNewPoints = starOfHopeActiveThisQuestion ? currentActivePoints : Math.max(0, currentActivePoints - currentSubQuestionPoints);
    socket.emit('adjust-player-points', { hostKey: currentRoom, targetClientId: activePlayerId, points: activeNewPoints, operation: 'set' });
    setPlayerPoints((prev) => ({ ...prev, [currentStealAttempt.id]: (prev[currentStealAttempt.id] || 0) + currentSubQuestionPoints, [activePlayerId]: activeNewPoints }));
    cleanupRoundWorkflow();
  };

  const handleStealVerdictIncorrect = () => {
    if (!currentStealAttempt || selectedPack === null) return;
    const penaltyPoints = Math.floor(currentSubQuestionPoints / 2);
    socket.emit('round4-steal-verdict', { hostKey: currentRoom, targetClientId: currentStealAttempt.id, correct: false, message: `Steal Failed: -${penaltyPoints}`, points: 0 });
    const stealerNewPoints = Math.max(0, (playerPoints[currentStealAttempt.id] || 0) - penaltyPoints);
    socket.emit('adjust-player-points', { hostKey: currentRoom, targetClientId: currentStealAttempt.id, points: stealerNewPoints, operation: 'set' });
    setPlayerPoints((prev) => ({ ...prev, [currentStealAttempt.id]: stealerNewPoints }));
    cleanupRoundWorkflow();
  };

  const executeGameTermination = () => {
    socket.emit('terminate-game', { hostKey: currentRoom });
    navigate('/host');
  };

  const handleMasterMorphButtonClick = () => {
    if (areAllPlayersFinished) { executeGameTermination(); return; }
    if (!activePlayerId) return;
    setCompletedPlayerIds(prev => ({ ...prev, [activePlayerId]: true }));
    setActivePlayerId(''); setTurnStaged(false); setSelectedPack(null); setCurrentSubQuestionIndex(null); setTurnFullyFinished(false); setStarOfHopeActiveThisQuestion(false);
    socket.emit('round4-turn-over', { hostKey: currentRoom });
  };

  const cleanupRoundWorkflow = () => {
    if (mainTimerRef.current) window.clearInterval(mainTimerRef.current);
    if (stealTimerRef.current) window.clearInterval(stealTimerRef.current);
    setQuestionSelected(false); setTimerRunning(false); setHostTimeLeft(null); setStealWindowOpen(false); setStealTimeLeft(null); setCurrentStealAttempt(null); setPlayerAnswers([]); setStarOfHopeActiveThisQuestion(false); 
    if (Object.values({ ...usedSubQuestions, [currentSubQuestionIndex!]: true }).every(v => v === true)) setTurnFullyFinished(true);
  };

  const adjustPlayerPoints = (id: string, val: number, op: 'set' | 'add') => {
    if (!currentRoom) return;
    const targetValue = Math.max(0, op === 'set' ? val : (playerPoints[id] || 0) + val);
    socket.emit('adjust-player-points', { hostKey: currentRoom, targetClientId: id, points: targetValue, operation: 'set' });
    setPlayerPoints((prev) => ({ ...prev, [id]: targetValue }));
  };

return (
    <div style={styles.wrapper}>
      <GameHeader title="Host Round 4 Dashboard">
        {!areAllPlayersFinished && <button onClick={executeGameTermination} style={styles.terminateButton}>🛑 Terminate Game</button>}
        <button onClick={handleMasterMorphButtonClick} style={styles.masterMorphButton(areAllPlayersFinished)}>{areAllPlayersFinished ? '🟢 Finish Game' : 'Reset Turn Standby'}</button>
      </GameHeader>

      <div style={styles.gridRow}>
        <div>
          <section style={styles.card}>
            <h2>Step 1: Active Turn Matrix</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
              {connectedClients.map((client) => (
                <button key={client.id} disabled={completedPlayerIds[client.id] || turnStaged || (activePlayerId !== '' && activePlayerId !== client.id)} onClick={() => selectActivePlayerTurn(client.id)} style={styles.playerButton(completedPlayerIds[client.id], activePlayerId === client.id)}>
                  {client.name} {completedPlayerIds[client.id] ? '[DONE]' : activePlayerId === client.id ? '[ACTIVE]' : '[READY]'}
                </button>
              ))}
            </div>
            {activePlayerId && !turnStaged && <button onClick={handleStagePlayerTurn} style={styles.stageButton}>🚀 Stage Player Turn</button>}
          </section>

          {turnStaged && (
            <section style={styles.card}>
              <h2>Step 2: Choose Point Pack</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                {([40, 60, 80] as PackValue[]).map((pack) => (
                  <button key={pack} disabled={questionSelected || turnFullyFinished} onClick={() => selectPack(pack)} style={styles.choosePack(selectedPack === pack)}>
                    {pack} pts
                  </button>
                ))}
              </div>
            </section>
          )}

          {selectedPack !== null && (
            <section style={styles.card}>
              <h2>Step 3: Questions Pool</h2>
              {!questionSelected && <button onClick={handleTriggerStarOfHopePreQuestion} disabled={starOfHopeUsedByPlayer[activePlayerId] === true || starOfHopeActiveThisQuestion === true || turnFullyFinished === true} style={styles.starActivation(starOfHopeActiveThisQuestion, starOfHopeUsedByPlayer[activePlayerId], turnFullyFinished)}>
                {starOfHopeActiveThisQuestion ? '🌟 Star Activated.' : turnFullyFinished ? 'Turn Complete' : starOfHopeUsedByPlayer[activePlayerId] ? '🌟 Already Used' : '🌟 Click to Activate Star of Hope'}
              </button>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(() => {
                  let nextSequentialIndex = 0;
                  if (usedSubQuestions[0]) nextSequentialIndex = 1;
                  if (usedSubQuestions[1]) nextSequentialIndex = 2;
                  const targetQuestionData = PROTOTYPE_QUESTION_BANK[selectedPack][nextSequentialIndex];
                  const isStagedOrRunning = questionSelected === true;
                  if (turnFullyFinished) return <p style={{ margin: 0, color: '#666', textAlign: 'center', fontStyle: 'italic' }}>All 3 questions completed.</p>;
                  return <button disabled={isStagedOrRunning} onClick={() => selectSubQuestion(nextSequentialIndex)} style={styles.nextQuestionButton(isStagedOrRunning)}>{isStagedOrRunning ? `⏳ Evaluation Active (Q${nextSequentialIndex + 1})` : `🚀 Spawn Next Question (Q${nextSequentialIndex + 1} — ${targetQuestionData.points} pts)`}</button>;
                })()}
              </div>
              {turnFullyFinished && (
                <section style={styles.finishTurnSection}>
                  <button onClick={handleMasterMorphButtonClick} style={styles.finishTurnButton}>🏁 Close Turn (Clear Clients to Standby)</button>
                </section>
              )}
            </section>
          )}
        </div>

        <div>
          {questionSelected && (
            <section style={styles.operationalDesk}>
              <div style={styles.deskHeader}>
                <h3>Operational Desk {starOfHopeActiveThisQuestion && <span style={{ color: '#ffb703' }}>(⭐ STAR ACTIVE)</span>}</h3>
                {!timerRunning && hostTimeLeft === null ? <button onClick={() => { startQuestionTimer(); socket.emit('round4-start-timer', { hostKey: currentRoom, duration: dynamicDuration }); }} style={styles.timerBtn}>Start {dynamicDuration}s Timer</button> : <span style={styles.timerDisplay}>Timer: {hostTimeLeft}s</span>}
              </div>
              <div style={styles.promptBox}><p style={{ margin: 0 }}>{questionPrompt}</p></div>
              <div>
                  <div style={styles.answerItem}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button disabled={stealWindowOpen} onClick={markVerdictCorrect} style={{ backgroundColor: '#4CAF50', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Correct</button>
                      <button disabled={stealWindowOpen} onClick={markVerdictIncorrect} style={{ backgroundColor: '#f44336', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Incorrect</button>
                    </div>
                  </div>
                
              </div>
              {stealWindowOpen && (
                <div style={styles.stealPanel}>
                  <div style={styles.stealHeader}><h4>Steal Buzz Active</h4>{stealTimeLeft !== null && <span style={{ color: '#ffb703', fontWeight: 'bold' }}>{stealTimeLeft}s</span>}</div>
                  {currentStealAttempt ? (
                    <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#1a0f29', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>{currentStealAttempt.name}</strong> buzzed!</span>
                      <div style={{ display: 'flex', gap: '8px' }}><button onClick={handleStealVerdictCorrect} style={{ backgroundColor: '#4CAF50', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Accept</button><button onClick={handleStealVerdictIncorrect} style={{ backgroundColor: '#f44336', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Deny</button></div>
                    </div>
                  ) : <p style={{ margin: '10px 0 0', fontStyle: 'italic', color: '#b5838d' }}>Awaiting buzzer click...</p>}
                </div>
              )}
            </section>
          )}
          <section style={styles.card}>
            <h2>Realtime Score Matrix</h2>
            {connectedClients.map((client) => (
              <div key={client.id} style={styles.scoreMatrixItem}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{client.name} {client.id === activePlayerId ? <span style={{ color: '#ffa000', fontSize: '0.8rem' }}>[ACTIVE]</span> : ''}</strong>
                  <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>{playerPoints[client.id] || 0} pts</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="number" placeholder="Delta" onChange={(e) => setManualPoints({ ...manualPoints, [client.id]: e.target.value })} style={styles.scoreInput} />
                  <button onClick={() => adjustPlayerPoints(client.id, Number(manualPoints[client.id]), 'add')} style={{ backgroundColor: '#264653', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
                  <button onClick={() => adjustPlayerPoints(client.id, Number(manualPoints[client.id]), 'set')} style={{ backgroundColor: '#e76f51', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Set</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}