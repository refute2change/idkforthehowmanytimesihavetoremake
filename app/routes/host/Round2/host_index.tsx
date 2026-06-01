// app/routes/host/Round2/host_index.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../../components/SocketContext';
import { socket } from '../../../socket';
import { GameHeader } from '../../../components/GameHeader';

interface Clue { id: number; label: string; question: string; answer: string; used: boolean; opened: boolean; active: boolean; }
interface PlayerAnswer { id: string; name: string; clueIndex: number; answer: string; time: string; accepted: boolean; keywordAttempted?: boolean; }
interface KeywordAttempt { id: string; name: string; answer: string; time: string; }

const initialClues: Clue[] = [
  { id: 0, label: 'Clue 1', question: 'A yellow fruit that monkeys love.', answer: 'banana', used: false, opened: false, active: false },
  { id: 1, label: 'Clue 2', question: 'The opposite of cold.', answer: 'hot', used: false, opened: false, active: false },
  { id: 2, label: 'Clue 3', question: 'A color made by mixing red and blue.', answer: 'purple', used: false, opened: false, active: false },
  { id: 3, label: 'Clue 4', question: 'The day that follows Friday.', answer: 'saturday', used: false, opened: false, active: false },
];
const finalClue: Clue = { id: 4, label: 'Final Clue', question: 'The thing players must discover to win the game.', answer: 'keyword', used: false, opened: false, active: false };

export default function HostRound2() {
  const { isConnected, currentRoom, connectedClients } = useSocket();
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
  const [failedPlayerIds, setFailedPlayerIds] = useState<{ [playerId: string]: boolean }>({});

  const hostTimerRef = useRef<number | null>(null);
  const keywordTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const styles = {
    wrapper: { padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh', fontFamily: 'sans-serif' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' },
    card: { padding: '16px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px' },
    playerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141414', border: '1px solid #2b2b2b', padding: '12px', borderRadius: '8px' },
    scoreInput: { width: '100px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#121212', color: '#fff' },
    terminateButton: {
      backgroundColor: '#f4a261', 
      color: 'white', 
      border: 'none', 
      padding: '10px 14px', 
      borderRadius: '4px', 
      cursor: 'pointer', 
      fontWeight: 'bold' 
    },
    clueChoiceText: { marginTop: '8px', color: '#888', fontSize: '0.85rem' },
    clueChoiceButton: (active: boolean, used: boolean) => ({
      padding: '16px',
      backgroundColor: active ? '#264653' : used ? '#333' : '#1e1e1e',
      border: '1px solid #444',
      borderRadius: '12px',
      color: '#fff',
      cursor: 'pointer'
    }),
    questionRevealButton: {
      backgroundColor: '#0a84ff', 
      color: '#fff', 
      padding: '10px 14px', 
      borderRadius: '8px', 
      border: 'none', 
      cursor: 'pointer'
    },
    timerButton: { backgroundColor: '#ffb703', padding: '10px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer' },
    keywordButton: (correct: boolean) => ({ backgroundColor: correct ? '#4CAF50' : '#FFA000', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }),
  };

  const clueCount = useMemo(() => clues.filter((c) => c.id !== 4 && c.used && !c.active).length, [clues]);
  const finalClueReady = clueCount >= 4;
  const finalClueVisible = clues.some((c) => c.id === 4 && !c.used);

  const haveAllPlayersFailedKeyword = useMemo(() => {
    if (connectedClients.length === 0) return false;
    return connectedClients.every((c) => failedPlayerIds[c.id] === true);
  }, [connectedClients, failedPlayerIds]);

  useEffect(() => {
    if (!isConnected || !currentRoom) navigate('/');
  }, [isConnected, currentRoom, navigate]);

  useEffect(() => {
    if (!isConnected) return;

    socket.on('player-answer', (d) => setPlayerAnswers((p) => [{ id: d.senderId, name: d.senderName || `Player ${d.senderId.slice(0, 6)}`, clueIndex: d.clueIndex, answer: d.answer, time: new Date().toLocaleTimeString(), accepted: false }, ...p]));
    socket.on('keyword-attempt', (d) => setKeywordAttempts((p) => [{ id: d.senderId, name: d.senderName || `Player ${d.senderId.slice(0, 6)}`, answer: d.answer, time: new Date().toLocaleTimeString() }, ...p]));
    socket.on('close-keyword-window', () => { setKeywordWindowOpen(false); setKeywordTimeLeft(null); });
    socket.on('player-attempted-keyword', (d) => setPlayerAnswers((p) => p.map((a) => a.id === d.senderId ? { ...a, keywordAttempted: true } : a)));

    return () => {
      socket.off('player-answer');
      socket.off('keyword-attempt');
      socket.off('player-attempted-keyword');
      socket.off('close-keyword-window');
    };
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected || connectedClients.length === 0 || !currentRoom) return;
    connectedClients.forEach((c) => socket.emit('request-player-points', { hostKey: currentRoom, targetClientId: c.id }));
  }, [isConnected, connectedClients, currentRoom]);

  useEffect(() => {
    if (!isConnected) return;
    socket.on('leaderboard-update', (d) => { if (Array.isArray(d.leaderboard)) { const m: any = {}; d.leaderboard.forEach((e: any) => { m[e.playerId] = e.points; }); setPlayerPoints(m); } });
    socket.on('player-points-response', (d) => d.playerId && setPlayerPoints((p) => ({ ...p, [d.playerId]: d.points })));
    socket.on('player-points-awarded', (d) => d.playerId && setPlayerPoints((p) => ({ ...p, [d.playerId]: d.points })));
    return () => {
      socket.off('leaderboard-update');
      socket.off('player-points-response');
      socket.off('player-points-awarded');
    };
  }, [isConnected]);

  const adjustPoints = (id: string, val: number, op: 'set' | 'add') => {
    socket.emit('adjust-player-points', { hostKey: currentRoom, targetClientId: id, points: val, operation: op });
    setPlayerPoints((p) => ({ ...p, [id]: op === 'set' ? val : (p[id] || 0) + val }));
  };

  const chooseClue = (clue: Clue) => {
    if (clue.used || gameWon || selectedClue) return;
    setClues((prev) => prev.map((item) => item.id === clue.id ? { ...item, used: true, active: true } : { ...item, active: false }));
    setSelectedClue(clue);
    socket.emit('select-clue', { hostKey: currentRoom, clueIndex: clue.id, final: clue.id === 4 });
    setSelectedClueRevealed(false);
  };

  const chooseFinalClue = () => {
    if (!finalClueVisible || gameWon) return;
    const final = clues.find((clue) => clue.id === 4);
    if (final) chooseClue(final);
  };

  const finalizeClueJudgement = () => {
    if (!selectedClue) return;
    const targets = playerAnswers.filter((a) => a.clueIndex === selectedClue.id);
    const anyAccepted = targets.some((a) => a.accepted);

    targets.forEach((a) => {
      socket.emit('clue-judgement', { hostKey: currentRoom, targetClientId: a.id, clueIndex: a.clueIndex, correct: a.accepted, message: a.accepted ? 'Correct!' : 'Incorrect.' });
      if (a.accepted) adjustPoints(a.id, 10, 'add');
    });

    setClues((prev) => prev.map((c) => c.id === selectedClue.id ? { ...c, opened: anyAccepted, active: false } : c));
    socket.emit('clue-state-update', { hostKey: currentRoom, clueIndex: selectedClue.id, opened: anyAccepted, answer: anyAccepted ? selectedClue.answer : undefined });
    setPlayerAnswers((prev) => prev.filter((a) => a.clueIndex !== selectedClue.id));
    setSelectedClue(null);
    setSelectedClueRevealed(false);
    if (selectedClue.id === 4) setKeywordWindowReady(true);
  };

  const startKeywordWindow = (duration = 15) => {
    socket.emit('start-keyword-window', { hostKey: currentRoom, duration });
    setKeywordWindowOpen(true);
    setKeywordWindowReady(false);
    setKeywordTimeLeft(duration);

    if (keywordTimerRef.current) window.clearInterval(keywordTimerRef.current);
    keywordTimerRef.current = window.setInterval(() => {
      setKeywordTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) {
          window.clearInterval(keywordTimerRef.current!);
          setKeywordWindowOpen(false);
          socket.emit('close-keyword-window', { hostKey: currentRoom });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const acceptKeyword = (attempt: KeywordAttempt, correct: boolean) => {
    socket.emit('keyword-verdict', { hostKey: currentRoom, targetClientId: attempt.id, correct, message: correct ? 'Solved!' : 'Wrong.' });
    if (correct) {
      const pts = 
        clueCount === 0 || (clueCount === 1 && !selectedClue) ? 80 :
        clueCount === 1 || (clueCount === 2 && !selectedClue) ? 60 :
        clueCount === 2 || (clueCount === 3 && !selectedClue) ? 40 :
        clueCount === 3 || (clueCount === 4 && !selectedClue) ? 20 :
        10;
      adjustPoints(attempt.id, pts, 'add');
      setKeywordAttempts([]);
      triggerMasterRevealSequence();
    } else {
      setFailedPlayerIds((p) => ({ ...p, [attempt.id]: true }));
    }
    setKeywordAttempts((prev) => prev.filter((item) => item.id !== attempt.id || item.time !== attempt.time));
  };

  const triggerMasterRevealSequence = () => {
    setGameWon(true);
    setKeywordWindowOpen(false);
    if (keywordTimerRef.current) window.clearInterval(keywordTimerRef.current);
    socket.emit('close-keyword-window', { hostKey: currentRoom });
    socket.emit('reveal-all-clues', { hostKey: currentRoom, clues: clues.map((c) => ({ id: c.id, label: c.label, question: c.question, answer: c.answer })) });
  };

  const revealQuestion = () => {
    if (!selectedClue) return;
    socket.emit('reveal-question', { hostKey: currentRoom, clueIndex: selectedClue.id, question: selectedClue.question, duration: 15, final: selectedClue.id === 4 });
    setSelectedClueRevealed(true);
  };

  const startTimer = () => {
    if (!selectedClue || !selectedClueRevealed) return;
    socket.emit('start-answer-window', { hostKey: currentRoom, clueIndex: selectedClue.id, duration: 15 });
    setHostTimeLeft(15);

    if (hostTimerRef.current) window.clearInterval(hostTimerRef.current);
    hostTimerRef.current = window.setInterval(() => {
      setHostTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) { window.clearInterval(hostTimerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const terminateGame = () => {
    socket.emit('terminate-game', { hostKey: currentRoom });
    setSelectedClue(null);
    setClues((prev) => prev.map((clue) => ({ ...clue, active: false })));
    setPlayerAnswers((prev) => prev.filter((answer) => answer.clueIndex !== selectedClue?.id));
    setSelectedClueRevealed(false);
    navigate('/host');
  };

  return (
    <div style={styles.wrapper}>
      <GameHeader title="Host Round2 Control Console" subTitle={gameWon ? '✨ Round Completed' : 'Match Live'}>
        <button 
          onClick={terminateGame} 
          style={styles.terminateButton}
        >
          {gameWon ? 'Finish Game' : 'Terminate Game'}
        </button>
      </GameHeader>

      <section style={{ marginBottom: '24px' }}>
        <h2>Clue Selection Registry</h2>
        <div style={styles.grid}>
          {clues.filter((c) => c.id !== 4).map((clue) => (
            <button key={clue.id} disabled={gameWon || (selectedClue !== null && selectedClue.id !== clue.id) || (clue.used && !clue.active)} onClick={() => chooseClue(clue)} style={styles.clueChoiceButton(clue.active, clue.used)}>
              {clue.label}
              <div style={styles.clueChoiceText}>{clue.active ? 'Current active' : clue.used ? 'Finalized' : 'Available'}</div>
            </button>
          ))}
          {finalClueVisible && (
            <button disabled={gameWon || selectedClue !== null || !finalClueReady} onClick={chooseFinalClue} style={styles.clueChoiceButton(finalClueReady, false)}>
              Final Clue
              <div style={styles.clueChoiceText}>{finalClueReady ? 'Unlocked' : 'Locked (Requires 4 clue runs)'}</div>
            </button>
          )}
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Clue Assessment Board</h2>
        {selectedClue ? (
          <div style={styles.card}>
            <h3>{selectedClueRevealed ? selectedClue.question : 'Question Hidden'}</h3>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={revealQuestion} disabled={selectedClueRevealed} style={styles.questionRevealButton}>Reveal Question</button>
              <button onClick={startTimer} disabled={!selectedClueRevealed || (hostTimeLeft !== null && hostTimeLeft > 0)} style={styles.timerButton}>Start 15s Timer</button>
            </div>

            <div style={{ marginTop: '20px' }}>
              {connectedClients.map((client) => {
                const ans = playerAnswers.find((a) => a.id === client.id && a.clueIndex === selectedClue.id);
                return (
                  <div key={client.id} style={styles.playerRow}>
                    <div>
                      <strong>{client.name}</strong>
                      <p style={{ margin: '4px 0 0', color: '#ddd' }}>{ans?.answer || 'Awaiting entry...'}</p>
                    </div>
                    {ans && (
                      <input type="checkbox" checked={ans.accepted} onChange={() => setPlayerAnswers((p) => p.map((item) => item.id === client.id ? { ...item, accepted: !item.accepted } : item))} style={{ width: '20px', height: '20px' }} />
                    )}
                  </div>
                );
              })}
              <button onClick={finalizeClueJudgement} disabled={hostTimeLeft !== 0} style={{ backgroundColor: hostTimeLeft === 0 ? '#4CAF50' : '#555', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '8px', marginTop: '12px', cursor: 'pointer' }}>Finalize Clue Outcome</button>
            </div>
          </div>
        ) : <p style={{ color: '#aaa' }}>Select an asset pack row element above to distribute questions.</p>}
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Scoreboard Realtime Feed</h2>
        <div style={styles.grid}>
          {connectedClients.map((client) => (
            <div key={client.id} style={styles.card}>
              <strong>{client.name}</strong> — <span style={{ color: '#4CAF50' }}>{playerPoints[client.id] || 0} PTS</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <input type="number" placeholder="Delta" onChange={(e) => setManualPoints({ ...manualPoints, [client.id]: e.target.value })} style={styles.scoreInput} />
                <button onClick={() => adjustPoints(client.id, Number(manualPoints[client.id]), 'add')} style={styles.keywordButton(true)}>Add</button>
                <button onClick={() => adjustPoints(client.id, Number(manualPoints[client.id]), 'set')} style={styles.keywordButton(false)}>Set</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Buzzer Claims Ledger</h2>
        {keywordAttempts.map((attempt, idx) => (
          <div key={idx} style={styles.card}>
            <strong>{attempt.name}</strong> attempted: "{attempt.answer}"
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button onClick={() => acceptKeyword(attempt, true)} style={styles.keywordButton(true)}>Correct</button>
              <button onClick={() => acceptKeyword(attempt, false)} style={styles.keywordButton(false)}>Incorrect</button>
            </div>
          </div>
        ))}
        
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          {keywordWindowReady && !keywordWindowOpen && !gameWon && (
            <button onClick={() => startKeywordWindow(15)} style={styles.timerButton}>Start Final Keyword Window</button>
          )}
          {haveAllPlayersFailedKeyword && !keywordWindowOpen && !gameWon && (
            <button onClick={triggerMasterRevealSequence} style={styles.timerButton}>🚨 Everyone Failed. Reveal Everything!</button>
          )}
        </div>
      </section>
    </div>
  );
}