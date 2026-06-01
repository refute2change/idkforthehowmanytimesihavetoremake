// app/routes/client/Round2/client_index.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../../components/SocketContext';
import { socket } from '../../../socket';
import { GameHeader } from '../../../components/GameHeader';
import { ClueProgressGrid } from '../../../components/ClueProgressGrid';
import { SubmissionForm } from '../../../components/SubmissionForm';

interface ClueQuestion {
  clueIndex: number;
  question: string;
  final: boolean;
  revealed?: boolean;
}

interface ClueProgressState {
  clueIndex: number;
  length: number;
  status: 'available' | 'selected' | 'opened' | 'failed';
  answer?: string;
}

const initialClueProgress: ClueProgressState[] = [
  { clueIndex: 0, length: 6, status: 'available' },
  { clueIndex: 1, length: 3, status: 'available' },
  { clueIndex: 2, length: 6, status: 'available' },
  { clueIndex: 3, length: 8, status: 'available' },
];

export default function ClientRound2() {
  const { isConnected, currentRoom, disconnectSocket } = useSocket();
  const [currentQuestion, setCurrentQuestion] = useState<ClueQuestion | null>(null);
  const [clueProgress, setClueProgress] = useState<ClueProgressState[]>(initialClueProgress);
  const [clueResult, setClueResult] = useState<string>('');
  const [keywordResult, setKeywordResult] = useState<string>('');
  const [answerText, setAnswerText] = useState('');
  const [latestSubmittedAnswer, setLatestSubmittedAnswer] = useState('');
  const [answerEnabled, setAnswerEnabled] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [keywordUsed, setKeywordUsed] = useState(false);
  const [keywordWindowOpen, setKeywordWindowOpen] = useState(false);
  const [keywordWindowClosed, setKeywordWindowClosed] = useState(false);
  const [keywordTimeLeft, setKeywordTimeLeft] = useState<number | null>(null);
  const [playerPoints, setPlayerPoints] = useState(0);
  const timerRef = useRef<number | null>(null);
  const keywordTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const styles = {
    wrapper: { padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh', fontFamily: 'sans-serif' },
    scoreContainer: { padding: '12px 16px', backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' as const },
    infoBox: { padding: '18px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px' },
    statusLabel: { marginTop: '12px', color: '#4CAF50', fontWeight: 'bold' }
  };

  const questionLabel = useMemo(() => {
    if (!currentQuestion) return 'No clue selected yet.';
    return currentQuestion.final ? 'Final clue' : `Clue ${currentQuestion.clueIndex + 1}`;
  }, [currentQuestion]);

  useEffect(() => {
    if (!isConnected || !currentRoom) navigate('/');
  }, [isConnected, currentRoom, navigate]);

  useEffect(() => {
    if (!isConnected) return;

    const handleClueSelected = (data: any) => {
      setCurrentQuestion({ clueIndex: data.clueIndex, question: data.question || 'No question available', final: Boolean(data.final), revealed: false });
      setAnswerEnabled(false);
      setClueResult('');
      setClueProgress((prev) => prev.map((item) => item.clueIndex === data.clueIndex ? { ...item, status: 'selected' } : (item.status === 'selected' ? { ...item, status: 'available' } : item)));
    };

    const handleClueResult = (data: any) => setClueResult(data.correct ? 'Your clue answer was accepted.' : 'Your clue answer was rejected.');
    
    const handleKeywordResult = (data: any) => {
      setKeywordResult(data.correct ? 'Keyword correct! Game over.' : 'Keyword attempt wrong.');
      if (data.correct) {
        setCurrentQuestion(null);
        setKeywordWindowOpen(false);
        setKeywordWindowClosed(true);
      }
    };

    const handleKeywordWindowStart = (data: any) => {
      const duration = data && typeof data.duration === 'number' ? data.duration : 15;
      setKeywordWindowOpen(true);
      setKeywordWindowClosed(false);
      setKeywordUsed(false);
      setKeywordTimeLeft(duration);

      if (keywordTimerRef.current) window.clearInterval(keywordTimerRef.current);
      keywordTimerRef.current = window.setInterval(() => {
        setKeywordTimeLeft((t) => {
          if (t === null) return null;
          if (t <= 1) {
            window.clearInterval(keywordTimerRef.current!);
            setKeywordWindowOpen(false);
            setKeywordWindowClosed(true);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    };

    const handleRevealAll = (data: any) => {
      if (!data || !Array.isArray(data.clues)) return;
      setClueProgress((prev) => prev.map((item) => {
        const match = data.clues.find((clue: any) => clue.id === item.clueIndex);
        return match ? { ...item, status: 'opened', answer: match.answer } : item;
      }));
    };

    const handleClueStateUpdate = (data: any) => {
      setClueProgress((prev) => prev.map((item) => item.clueIndex !== data.clueIndex ? item : { ...item, status: data.opened ? 'opened' : 'failed', answer: data.opened ? data.answer : undefined }));
    };

    const handleHostOfflineEviction = () => {
      navigate('/');
      if (disconnectSocket) disconnectSocket();
    };

    socket.on('clue-selected', handleClueSelected);
    socket.on('clue-result', handleClueResult);
    socket.on('keyword-result', handleKeywordResult);
    socket.on('keyword-correct', handleKeywordResult);
    socket.on('reveal-all-clues', handleRevealAll);
    socket.on('reveal-question', handleRevealQuestion);
    socket.on('start-answer-window', handleStartAnswerWindow);
    socket.on('start-keyword-window', handleKeywordWindowStart);
    socket.on('close-keyword-window', () => { setKeywordWindowOpen(false); setKeywordWindowClosed(true); });
    socket.on('clue-state-update', handleClueStateUpdate);
    socket.on('host-offline-evict', handleHostOfflineEviction);

    return () => {
      socket.off('clue-selected', handleClueSelected);
      socket.off('clue-result', handleClueResult);
      socket.off('keyword-result', handleKeywordResult);
      socket.off('keyword-correct', handleKeywordResult);
      socket.off('reveal-all-clues', handleRevealAll);
      socket.off('reveal-question', handleRevealQuestion);
      socket.off('start-answer-window', handleStartAnswerWindow);
      socket.off('start-keyword-window', handleKeywordWindowStart);
      socket.off('clue-state-update', handleClueStateUpdate);
      socket.off('host-offline-evict', handleHostOfflineEviction);
      if (timerRef.current){
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (keywordTimerRef.current){
        window.clearInterval(keywordTimerRef.current);
        keywordTimerRef.current = null;
      }
    };
  }, [isConnected, navigate, disconnectSocket]);

  function handleRevealQuestion(data: any) {
    if (!data) return;
    setCurrentQuestion({ clueIndex: data.clueIndex, question: data.question || 'No question available', final: Boolean(data.final), revealed: true });
    setClueResult('');
  }

  function handleStartAnswerWindow(data: any) {
    if (!data) return;
    const secs = typeof data.duration === 'number' ? data.duration : 15;
    setTimeLeft(secs);
    setAnswerEnabled(true);

    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) {
          setAnswerEnabled(false);
          window.clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    if (!isConnected) return;
    socket.emit('get-player-points', { targetClientId: socket.id });
    socket.on('terminate-game', () => navigate('/play'));
    socket.on('player-points-update', (d: any) => typeof d.points === 'number' && setPlayerPoints(d.points));
    socket.on('current-player-points', (d: any) => typeof d.points === 'number' && setPlayerPoints(d.points));
    return () => {
      socket.off('terminate-game');
      socket.off('player-points-update');
      socket.off('current-player-points');
    };
  }, [isConnected, navigate]);

  const sendAnswer = () => {
    if (!currentRoom || !currentQuestion || !answerText.trim()) return;
    socket.emit('clue-answer', { hostKey: currentRoom, clueIndex: currentQuestion.clueIndex, answer: answerText.trim() });
    setLatestSubmittedAnswer(answerText.trim());
    setAnswerText('');
  };

  const sendKeyword = () => {
    if (!currentRoom || keywordUsed || keywordWindowClosed || !currentQuestion) return;
    socket.emit('keyword-answer', { hostKey: currentRoom, answer: 'keyword attempt' });
    socket.emit('player-attempted-keyword', { hostKey: currentRoom, clueIndex: currentQuestion.clueIndex });
    setKeywordUsed(true);
  };

  if (!isConnected || !currentRoom) return <div style={{ color: '#fff', padding: '20px' }}>Connecting to Round2...</div>;

  return (
    <div style={styles.wrapper}>
      <GameHeader title="Player Round2 Game" />

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h2>Clue progress</h2>
          <ClueProgressGrid progressList={clueProgress} />
        </div>
        <div style={styles.scoreContainer}>
          <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>Accumulated Score</p>
          <p style={{ margin: '4px 0 0', color: '#4CAF50', fontSize: '2rem', fontWeight: 'bold', lineHeight: 1 }}>{playerPoints}</p>
        </div>
      </div>

      <section style={{ marginBottom: '24px' }}>
        <h2>{questionLabel}</h2>
        <div style={styles.infoBox}>
          <p style={{ margin: 0 }}>{currentQuestion?.question || 'Waiting for the host to choose a clue.'}</p>
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Submit your clue answer</h2>
        <SubmissionForm value={answerText} onChange={setAnswerText} onSubmit={sendAnswer} disabled={!answerEnabled || keywordUsed} placeholder="Type your answer and press Enter" buttonText="Submit Answer" />
        {clueResult && <p style={styles.statusLabel}>{clueResult}</p>}
        {timeLeft !== null && <p style={{ marginTop: '8px', color: '#ffb703' }}>Time left: {timeLeft}s</p>}
        {latestSubmittedAnswer && <p style={{ marginTop: '8px', color: '#ccc' }}>Your latest submission: {latestSubmittedAnswer}</p>}
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Submit keyword attempt</h2>
        {!keywordUsed && !keywordWindowClosed ? (
          <button onClick={sendKeyword} style={{ backgroundColor: '#6a1b9a', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Attempt Keyword</button>
        ) : (
          <p style={{ color: '#888' }}>{keywordUsed ? 'Keyword attempt sent. Waiting for host decision.' : 'The keyword attempt window is closed.'}</p>
        )}
        {keywordWindowOpen && keywordTimeLeft !== null && <p style={{ marginTop: '8px', color: '#ffb703' }}>Keyword time left: {keywordTimeLeft}s</p>}
        {keywordResult && <p style={styles.statusLabel}>{keywordResult}</p>}
      </section>
    </div>
  );
}