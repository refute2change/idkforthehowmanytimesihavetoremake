import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../../components/SocketContext';
import { socket } from '../../../socket';

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
  const [playerGameOver, setPlayerGameOver] = useState(false);
  const [playerPoints, setPlayerPoints] = useState(0);
  const timerRef = useRef<number | null>(null);
  const keywordTimerRef = useRef<number | null>(null);
  const [questionHistory, setQuestionHistory] = useState<string[]>([]);
  const navigate = useNavigate();

  const questionLabel = useMemo(() => {
    if (!currentQuestion) return 'No clue selected yet.';
    return currentQuestion.final ? 'Final clue' : `Clue ${currentQuestion.clueIndex + 1}`;
  }, [currentQuestion]);

  useEffect(() => {
    if (!isConnected || !currentRoom) {
      navigate('/');
    }
  }, [isConnected, currentRoom, navigate]);

  useEffect(() => {
    if (!isConnected) return;

    const handleClueSelected = (data: any) => {
      const nextQuestion = {
        clueIndex: data.clueIndex,
        // store question text but mark as unrevealed until host triggers reveal
        question: data.question || 'No question available',
        final: Boolean(data.final),
      };
      setCurrentQuestion({ ...nextQuestion, revealed: false });
      setAnswerEnabled(false);
      setClueResult('');
      setClueProgress((prev) => prev.map((item) => {
        if (item.clueIndex === data.clueIndex) {
          return { ...item, status: 'selected' };
        }
        if (item.status === 'selected') {
          return { ...item, status: 'available' };
        }
        return item;
      }));
    };

    const handleClueResult = (data: any) => {
      setClueResult(data.correct ? 'Your clue answer was accepted.' : 'Your clue answer was rejected.');
    };

    const handleKeywordResult = (data: any) => {
      setKeywordResult(data.correct ? 'Keyword correct! Game over.' : 'Keyword attempt wrong.');
      setPlayerGameOver(true);
      if (data.correct) {
        setCurrentQuestion(null);
        setKeywordWindowOpen(false);
        setKeywordWindowClosed(true);
      }
    };

    const handleKeywordWindowStart = (data: any) => {
      if (!data) return;
      const duration = typeof data.duration === 'number' ? data.duration : 15;
      setKeywordWindowOpen(true);
      setKeywordWindowClosed(false);
      setKeywordUsed(false);
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
            setKeywordWindowClosed(true);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    };

    const handleCloseKeywordWindow = () => {
      setKeywordWindowOpen(false);
      setKeywordWindowClosed(true);
      setKeywordTimeLeft(null);
    };

    const handleRevealAll = (data: any) => {
      if (!data || !Array.isArray(data.clues)) return;
      setQuestionHistory((prev) => [...prev, ...data.clues.map((clue: any) => `${clue.label}: ${clue.answer}`)]);
      setClueProgress((prev) => prev.map((item) => {
        const matchingClue = data.clues.find((clue: any) => clue.id === item.clueIndex);
        if (!matchingClue) return item;
        return {
          ...item,
          status: 'opened',
          answer: matchingClue.answer,
        };
      }));
    };

    const handleClueStateUpdate = (data: any) => {
      setClueProgress((prev) => prev.map((item) => {
        if (item.clueIndex !== data.clueIndex) return item;
        return {
          ...item,
          status: data.opened ? 'opened' : 'failed',
          answer: data.opened ? data.answer : undefined,
        };
      }));
    };

    socket.on('clue-selected', handleClueSelected);
    socket.on('clue-result', handleClueResult);
    socket.on('keyword-result', handleKeywordResult);
    socket.on('keyword-correct', handleKeywordResult);
    socket.on('reveal-all-clues', handleRevealAll);
    socket.on('reveal-question', handleRevealQuestion as any);
    socket.on('start-answer-window', handleStartAnswerWindow as any);
    socket.on('start-keyword-window', handleKeywordWindowStart as any);
    socket.on('close-keyword-window', handleCloseKeywordWindow);
    socket.on('clue-state-update', handleClueStateUpdate);

    return () => {
      socket.off('clue-selected', handleClueSelected);
      socket.off('clue-result', handleClueResult);
      socket.off('keyword-result', handleKeywordResult);
      socket.off('keyword-correct', handleKeywordResult);
      socket.off('reveal-all-clues', handleRevealAll);
      socket.off('reveal-question', handleRevealQuestion as any);
      socket.off('start-answer-window', handleStartAnswerWindow as any);
      socket.off('start-keyword-window', handleKeywordWindowStart as any);
      socket.off('close-keyword-window', handleCloseKeywordWindow);
      socket.off('clue-state-update', handleClueStateUpdate);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isConnected]);

  function handleRevealQuestion(data: any) {
    if (!data) return;
    const { clueIndex, question, duration } = data;
    const nextQuestion: ClueQuestion = {
      clueIndex,
      question: question || 'No question available',
      final: Boolean(data.final),
      revealed: true,
    };

    setCurrentQuestion(nextQuestion);
    setQuestionHistory((prev) => [nextQuestion.question, ...prev]);
    setClueResult('');
  }

  function handleStartAnswerWindow(data: any) {
    if (!data) return;
    const { duration } = data;
    const secs = typeof duration === 'number' ? duration : 15;

    setTimeLeft(secs);
    setAnswerEnabled(true);

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) {
          setAnswerEnabled(false);
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    if (!isConnected) return;

    const handleTerminateGame = () => {
      navigate('/play');
    };

    const handlePlayerPoints = (data: any) => {
      if (typeof data.points === 'number') {
        setPlayerPoints(data.points);
      }
    };

    // Fetch accumulated points from server when component mounts
    socket.emit('get-player-points', { targetClientId: socket.id });

    socket.on('terminate-game', handleTerminateGame);
    socket.on('player-points-update', handlePlayerPoints);
    socket.on('current-player-points', handlePlayerPoints);
    return () => {
      socket.off('terminate-game', handleTerminateGame);
      socket.off('player-points-update', handlePlayerPoints);
      socket.off('current-player-points', handlePlayerPoints);
    };
  }, [isConnected, navigate]);

  const sendAnswer = () => {
    if (!currentRoom || !currentQuestion || !answerText.trim()) return;
    socket.emit('clue-answer', {
      hostKey: currentRoom,
      clueIndex: currentQuestion.clueIndex,
      answer: answerText.trim(),
    });
    // keep locally so player can see their latest submission and can retype/resubmit until timer expires
    setLatestSubmittedAnswer(answerText.trim());
    setAnswerText('');
  };

  const sendKeyword = () => {
    if (!currentRoom || keywordUsed || keywordWindowClosed || !currentQuestion) return;
    socket.emit('keyword-answer', {
      hostKey: currentRoom,
      answer: 'keyword attempt',
    });
    socket.emit('player-attempted-keyword', {
      hostKey: currentRoom,
      clueIndex: currentQuestion.clueIndex,
    });
    setKeywordUsed(true);
  };

  const handleLeave = () => {
    disconnectSocket();
  };

  if (!isConnected || !currentRoom) {
    return <div style={{ color: '#fff', padding: '20px' }}>Connecting to Round2...</div>;
  }

  return (
    <div style={{ padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Player Round2 Game</h1>
          <p>Room: <span style={{ color: '#4CAF50', fontFamily: 'monospace' }}>{currentRoom}</span></p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ padding: '12px 16px', backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
            <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>Your Points</p>
            <p style={{ margin: '4px 0 0', color: '#4CAF50', fontSize: '1.4rem', fontWeight: 'bold' }}>{playerPoints}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => navigate('/play')} style={{ backgroundColor: '#555', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>
              Back to Client View
            </button>
            <button onClick={handleLeave} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>
              Leave Room
            </button>
          </div>
        </div>
      </div>

      <hr style={{ borderColor: '#333', margin: '20px 20px 24px' }} />

      <section style={{ marginBottom: '24px' }}>
        <h2>Clue progress</h2>
        <div style={{ display: 'grid', gap: '16px', marginBottom: '18px' }}>
          {clueProgress.map((progress) => {
            const isSelected = progress.status === 'selected';
            const isOpened = progress.status === 'opened';
            const isFailed = progress.status === 'failed';
            const backgroundColor = isFailed
              ? '#444'
              : isSelected || isOpened
              ? '#1fc7d4'
              : '#142b52';
            const textColor = isOpened ? '#fff' : 'transparent';

            return (
              <div key={progress.clueIndex} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ minWidth: '84px', color: '#ddd', fontSize: '0.94rem' }}>
                  Clue {progress.clueIndex + 1}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {Array.from({ length: progress.length }, (_, index) => (
                    <div
                      key={index}
                      style={{
                        width: '38px',
                        height: '44px',
                        borderRadius: '8px',
                        backgroundColor,
                        color: textColor,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '1rem',
                        fontWeight: 700,
                        border: isSelected ? '2px solid #7be4ee' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {isOpened ? progress.answer?.charAt(index).toUpperCase() : ''}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <h2>{questionLabel}</h2>
        <div style={{ padding: '18px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px' }}>
          {currentQuestion ? (
            <p style={{ margin: 0 }}>{currentQuestion.question}</p>
          ) : (
            <p style={{ margin: 0, color: '#888' }}>Waiting for the host to choose a clue.</p>
          )}
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Submit your clue answer</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Type your answer and press Enter"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (answerEnabled) sendAnswer();
                
              }
            }}
            disabled={!answerEnabled || keywordUsed}
            style={{ flex: 1, minWidth: '240px', padding: '12px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1e1e1e', color: '#fff' }}
          />
          <button onClick={sendAnswer} disabled={!answerEnabled || keywordUsed} style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: (answerEnabled && !keywordUsed) ? '#4CAF50' : '#555', color: '#fff', border: 'none', cursor: (answerEnabled && !keywordUsed) ? 'pointer' : 'not-allowed' }}>
            Submit Answer
          </button>
        </div>
        {clueResult && <p style={{ marginTop: '12px', color: '#4CAF50' }}>{clueResult}</p>}
        {timeLeft !== null && (
          <p style={{ marginTop: '8px', color: '#ffb703' }}>Time left: {timeLeft}s</p>
        )}
        {latestSubmittedAnswer && <p style={{ marginTop: '8px', color: '#ccc' }}>Your latest submission: {latestSubmittedAnswer}</p>}
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Submit keyword attempt</h2>
        {!keywordUsed && !keywordWindowClosed ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={sendKeyword} style={{ backgroundColor: '#6a1b9a', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer' }}>
              Attempt Keyword
            </button>
          </div>
        ) : keywordUsed ? (
          <p style={{ color: '#888' }}>Keyword attempt sent. Waiting for host decision.</p>
        ) : (
          <p style={{ color: '#888' }}>The keyword attempt window is closed.</p>
        )}
        {keywordWindowOpen && keywordTimeLeft !== null && (
          <p style={{ marginTop: '8px', color: '#ffb703' }}>Keyword time left: {keywordTimeLeft}s</p>
        )}
        {keywordResult && <p style={{ marginTop: '12px', color: '#4CAF50' }}>{keywordResult}</p>}
      </section>
    </div>
  );
}
