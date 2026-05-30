import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../../components/SocketContext';
import { socket } from '../../../socket';

interface ClueQuestion {
  clueIndex: number;
  question: string;
  final: boolean;
}

export default function ClientRound2() {
  const { isConnected, currentRoom, disconnectSocket } = useSocket();
  const [currentQuestion, setCurrentQuestion] = useState<ClueQuestion | null>(null);
  const [clueResult, setClueResult] = useState<string>('');
  const [keywordResult, setKeywordResult] = useState<string>('');
  const [answerText, setAnswerText] = useState('');
  const [keywordUsed, setKeywordUsed] = useState(false);
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
        question: data.question || 'No question available',
        final: Boolean(data.final),
      };
      setCurrentQuestion(nextQuestion);
      setQuestionHistory((prev) => [nextQuestion.question, ...prev]);
      setClueResult('');
    };

    const handleClueResult = (data: any) => {
      setClueResult(data.correct ? 'Your clue answer was accepted.' : 'Your clue answer was rejected.');
    };

    const handleKeywordResult = (data: any) => {
      setKeywordResult(data.correct ? 'Keyword correct! Game over.' : 'Keyword attempt wrong.');
      if (data.correct) {
        setCurrentQuestion(null);
      }
    };

    const handleRevealAll = (data: any) => {
      setQuestionHistory((prev) => [...prev, ...data.clues.map((clue: any) => `${clue.label}: ${clue.answer}`)]);
    };

    socket.on('clue-selected', handleClueSelected);
    socket.on('clue-result', handleClueResult);
    socket.on('keyword-result', handleKeywordResult);
    socket.on('keyword-correct', handleKeywordResult);
    socket.on('reveal-all-clues', handleRevealAll);

    return () => {
      socket.off('clue-selected', handleClueSelected);
      socket.off('clue-result', handleClueResult);
      socket.off('keyword-result', handleKeywordResult);
      socket.off('keyword-correct', handleKeywordResult);
      socket.off('reveal-all-clues', handleRevealAll);
    };
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;

    const handleTerminateGame = () => {
      navigate('/play');
    };

    socket.on('terminate-game', handleTerminateGame);
    return () => {
      socket.off('terminate-game', handleTerminateGame);
    };
  }, [isConnected, navigate]);

  const sendAnswer = () => {
    if (!currentRoom || !currentQuestion || !answerText.trim()) return;
    socket.emit('clue-answer', {
      hostKey: currentRoom,
      clueIndex: currentQuestion.clueIndex,
      answer: answerText.trim(),
    });
    setAnswerText('');
  };

  const sendKeyword = () => {
    if (!currentRoom || keywordUsed) return;
    socket.emit('keyword-answer', {
      hostKey: currentRoom,
      answer: 'keyword attempt',
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
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => navigate('/play')} style={{ backgroundColor: '#555', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            Back to Client View
          </button>
          <button onClick={handleLeave} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            Leave Room
          </button>
        </div>
      </div>

      <hr style={{ borderColor: '#333', margin: '20px 20px 24px' }} />

      <section style={{ marginBottom: '24px' }}>
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
                sendAnswer();
              }
            }}
            style={{ flex: 1, minWidth: '240px', padding: '12px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1e1e1e', color: '#fff' }}
          />
        </div>
        {clueResult && <p style={{ marginTop: '12px', color: '#4CAF50' }}>{clueResult}</p>}
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Submit keyword attempt</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={sendKeyword} disabled={keywordUsed} style={{ backgroundColor: keywordUsed ? '#555' : '#6a1b9a', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: keywordUsed ? 'not-allowed' : 'pointer' }}>
            {keywordUsed ? 'Keyword Used' : 'Attempt Keyword'}
          </button>
        </div>
        {keywordResult && <p style={{ marginTop: '12px', color: '#4CAF50' }}>{keywordResult}</p>}
      </section>
    </div>
  );
}
