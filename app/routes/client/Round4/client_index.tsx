import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../../components/SocketContext';
import { socket } from '../../../socket';

interface Round4QuestionState {
  question: string;
  value: number;
  activePlayerId: string;
  activePlayerName: string;
  star: boolean;
}

export default function ClientRound4() {
  const { isConnected, currentRoom, disconnectSocket } = useSocket();
  const [round4State, setRound4State] = useState<Round4QuestionState | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerStatus, setAnswerStatus] = useState<string>('');
  const [stealStatus, setStealStatus] = useState<string>('');
  const [stealWindowOpen, setStealWindowOpen] = useState(false);
  const [stealAttempted, setStealAttempted] = useState(false);
  const [currentStealPlayer, setCurrentStealPlayer] = useState<string>('');
  const [playerPoints, setPlayerPoints] = useState(0);
  const [roundStarted, setRoundStarted] = useState(false);
  const [questionVisible, setQuestionVisible] = useState(false);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const navigate = useNavigate();

  const amActivePlayer = useMemo(() => {
    return round4State?.activePlayerId === socket.id;
  }, [round4State]);

  useEffect(() => {
    if (!isConnected || !currentRoom) {
      navigate('/');
    }
  }, [isConnected, currentRoom, navigate]);

  useEffect(() => {
    if (!isConnected) return;

    const handleOpenRound4 = () => {
      navigate('/play/round4');
    };

    const handleStartQuestion = (data: any) => {
      if (!data) return;
      setRound4State({
        question: data.question || 'No question provided',
        value: typeof data.value === 'number' ? data.value : 40,
        activePlayerId: data.activePlayerId,
        activePlayerName: data.activePlayerName || 'Active player',
        star: Boolean(data.star),
      });
      setRoundStarted(true);
      setQuestionVisible(true);
      setAnswerText('');
      setAnswerSubmitted(false);
      setAnswerStatus('');
      setStealStatus('');
      setStealWindowOpen(false);
      setStealAttempted(false);
      setCurrentStealPlayer('');
    };

    const handleOpenStealWindow = () => {
      setStealWindowOpen(true);
      setStealStatus('Steal window is open. You may attempt to steal if you are not the active player.');
    };

    const handleCloseStealWindow = () => {
      setStealWindowOpen(false);
      setCurrentStealPlayer('');
      setStealStatus('Steal window is closed.');
    };

    const handleStealFirst = (data: any) => {
      if (!data) return;
      const playerName = data.playerName || `Player ${data.playerId.slice(0, 6)}`;
      setCurrentStealPlayer(playerName);
      setStealStatus(`${playerName} has attempted the steal.`);
    };

    const handleAnswerResult = (data: any) => {
      if (!data) return;
      setAnswerStatus(data.correct ? `Correct! ${data.message || ''}` : `Incorrect. ${data.message || ''}`);
      if (data.correct) {
        setRoundStarted(false);
      }
    };

    const handleStealResult = (data: any) => {
      if (!data) return;
      setStealStatus(data.correct ? `Steal success! ${data.message || ''}` : `Steal failed. ${data.message || ''}`);
      setStealWindowOpen(false);
      setStealAttempted(false);
    };

    const handlePlayerPoints = (data: any) => {
      if (typeof data.points === 'number') {
        setPlayerPoints(data.points);
      }
    };

    socket.on('open-round4', handleOpenRound4);
    socket.on('round4-start-question', handleStartQuestion);
    socket.on('round4-open-steal-window', handleOpenStealWindow);
    socket.on('round4-close-steal-window', handleCloseStealWindow);
    socket.on('round4-steal-first', handleStealFirst);
    socket.on('round4-answer-result', handleAnswerResult);
    socket.on('round4-steal-result', handleStealResult);
    socket.on('player-points-update', handlePlayerPoints);
    socket.on('current-player-points', handlePlayerPoints);

    socket.emit('get-player-points', { targetClientId: socket.id });

    return () => {
      socket.off('open-round4', handleOpenRound4);
      socket.off('round4-start-question', handleStartQuestion);
      socket.off('round4-open-steal-window', handleOpenStealWindow);
      socket.off('round4-close-steal-window', handleCloseStealWindow);
      socket.off('round4-steal-first', handleStealFirst);
      socket.off('round4-answer-result', handleAnswerResult);
      socket.off('round4-steal-result', handleStealResult);
      socket.off('player-points-update', handlePlayerPoints);
      socket.off('current-player-points', handlePlayerPoints);
    };
  }, [isConnected, navigate]);

  const sendAnswer = () => {
    if (!currentRoom || !round4State || !answerText.trim() || !amActivePlayer || answerSubmitted) return;
    socket.emit('round4-answer', {
      hostKey: currentRoom,
      answer: answerText.trim(),
    });
    setAnswerSubmitted(true);
    setAnswerStatus('Answer submitted. Waiting for host judgement...');
  };

  const sendStealAttempt = () => {
    if (!currentRoom || !round4State || round4State.activePlayerId === socket.id || stealAttempted || !stealWindowOpen) return;
    socket.emit('round4-steal-attempt', { hostKey: currentRoom });
    setStealAttempted(true);
    setStealStatus('Steal attempt sent. Waiting for host response...');
  };

  const handleLeave = () => {
    disconnectSocket();
  };

  if (!isConnected || !currentRoom) {
    return <div style={{ color: '#fff', padding: '20px' }}>Connecting to Round4...</div>;
  }

  return (
    <div style={{ padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Player Round4 Game</h1>
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

      <hr style={{ borderColor: '#333', margin: '20px 0' }} />

      <section style={{ marginBottom: '24px' }}>
        <h2>Current Round4 Question</h2>
        <div style={{ padding: '18px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px', minHeight: '120px' }}>
          {round4State ? (
            <>
              <p style={{ margin: 0, color: '#ccc' }}>Active player: <strong>{round4State.activePlayerName}</strong></p>
              <p style={{ margin: '8px 0 0' }}>{round4State.question}</p>
            </>
          ) : (
            <p style={{ margin: 0, color: '#888' }}>Waiting for the host to start Round4.</p>
          )}
        </div>
      </section>

      <section style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        <div style={{ backgroundColor: '#181818', borderRadius: '12px', border: '1px solid #333', padding: '16px' }}>
          <h3>Answer as active player</h3>
          <p style={{ color: '#888', margin: '0 0 12px' }}>{amActivePlayer ? 'You are the active player.' : 'Only the active player can submit the answer.'}</p>
          <textarea
            rows={4}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            disabled={!round4State || !amActivePlayer || answerSubmitted}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', backgroundColor: '#0f0f0f', color: '#fff' }}
            placeholder="Type your answer here"
          />
          <button
            onClick={sendAnswer}
            disabled={!round4State || !amActivePlayer || !answerText.trim() || answerSubmitted}
            style={{
              marginTop: '12px',
              padding: '12px 16px',
              backgroundColor: !round4State || !amActivePlayer || !answerText.trim() || answerSubmitted ? '#555' : '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: !round4State || !amActivePlayer || !answerText.trim() || answerSubmitted ? 'not-allowed' : 'pointer',
            }}
          >
            Submit Answer
          </button>
        </div>

        <div style={{ backgroundColor: '#181818', borderRadius: '12px', border: '1px solid #333', padding: '16px' }}>
          <h3>Steal panel</h3>
          <p style={{ color: '#888', margin: '0 0 12px' }}>
            {stealWindowOpen ? 'Steal is open for non-active players.' : 'Steal is closed.'}
          </p>
          <button
            onClick={sendStealAttempt}
            disabled={!round4State || !stealWindowOpen || stealAttempted || amActivePlayer}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: !round4State || !stealWindowOpen || stealAttempted || amActivePlayer ? '#555' : '#8E24AA',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: !round4State || !stealWindowOpen || stealAttempted || amActivePlayer ? 'not-allowed' : 'pointer',
            }}
          >
            Attempt Steal
          </button>
          <p style={{ marginTop: '16px', color: '#ccc' }}>{stealStatus}</p>
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Game Status</h2>
        <div style={{ padding: '16px', backgroundColor: '#111', borderRadius: '12px', border: '1px solid #333' }}>
          <p style={{ margin: '0 0 10px', color: '#ccc' }}>Answer status:</p>
          <p style={{ margin: 0, color: '#fff' }}>{answerStatus || 'No answer yet.'}</p>
        </div>
      </section>
    </div>
  );
}
