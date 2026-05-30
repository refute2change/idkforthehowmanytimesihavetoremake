import { useEffect, useMemo, useState } from 'react';
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
}

interface KeywordAttempt {
  id: string;
  name: string;
  answer: string;
  time: string;
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
  const { isConnected, currentRoom, disconnectSocket } = useSocket();
  const [clues, setClues] = useState<Clue[]>([...initialClues, finalClue]);
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [playerAnswers, setPlayerAnswers] = useState<PlayerAnswer[]>([]);
  const [keywordAttempts, setKeywordAttempts] = useState<KeywordAttempt[]>([]);
  const [gameWon, setGameWon] = useState(false);
  const navigate = useNavigate();

  const clueCount = useMemo(() => clues.filter((clue) => clue.used && clue.id !== 4).length, [clues]);
  const finalClueVisible = clueCount >= 4 && clues.some((clue) => clue.id === 4 && !clue.used);
  const currentClueAnswers = useMemo(
    () => playerAnswers
      .map((answer, index) => ({ ...answer, originalIndex: index }))
      .filter((answer) => selectedClue && answer.clueIndex === selectedClue.id),
    [playerAnswers, selectedClue],
  );

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

    socket.on('player-answer', handlePlayerAnswer);
    socket.on('keyword-attempt', handleKeywordAttempt);

    return () => {
      socket.off('player-answer', handlePlayerAnswer);
      socket.off('keyword-attempt', handleKeywordAttempt);
    };
  }, [isConnected]);

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
      question: clue.question,
      final: clue.id === 4,
    });
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
    });

    setClues((prev) => prev.map((clue) => {
      if (clue.id === selectedClue.id) {
        return { ...clue, opened: anyAccepted, active: false };
      }
      return clue;
    }));

    setPlayerAnswers((prev) => prev.filter((answer) => answer.clueIndex !== selectedClue.id));
    setSelectedClue(null);
  };

  const acceptKeyword = (attempt: KeywordAttempt, correct: boolean) => {
    socket.emit('keyword-verdict', {
      hostKey: currentRoom,
      targetClientId: attempt.id,
      correct,
      message: correct ? 'You found the keyword! Game over.' : 'Keyword attempt is incorrect.',
    });

    if (correct) {
      setGameWon(true);
      socket.emit('reveal-all-clues', {
        hostKey: currentRoom,
        clues: clues.map((clue) => ({ id: clue.id, label: clue.label, question: clue.question, answer: clue.answer })),
      });
    }
  };

  const terminateGame = () => {
    socket.emit('terminate-game', { hostKey: currentRoom });
    setSelectedClue(null);
    setClues((prev) => prev.map((clue) => ({ ...clue, active: false })));
    setPlayerAnswers((prev) => prev.filter((answer) => answer.clueIndex !== selectedClue?.id));
    navigate('/host');
  };

  const handleLeave = () => {
    disconnectSocket();
  };

  if (!isConnected || !currentRoom) {
    return <div style={{ color: '#fff', padding: '20px' }}>Loading Round2 game...</div>;
  }

  return (
    <div style={{ padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Host Round2 Game</h1>
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

      <hr style={{ borderColor: '#333', margin: '20px 20px 24px' }} />

      <section style={{ marginBottom: '24px' }}>
        <h2>Choose a clue</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
          {clues.map((clue) => {
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
              disabled={gameWon || selectedClue !== null}
              onClick={chooseFinalClue}
              style={{ padding: '16px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '12px', color: '#fff', cursor: gameWon || selectedClue !== null ? 'not-allowed' : 'pointer' }}
            >
              Final Clue
              <div style={{ marginTop: '8px', color: '#888', fontSize: '0.9rem' }}>
                {finalClue.used ? 'Selected' : 'Ready'}
              </div>
            </button>
          )}
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Current Question</h2>
        {selectedClue ? (
          <div style={{ padding: '18px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px' }}>
            <p style={{ margin: 0, fontSize: '1.05rem' }}>{selectedClue.question}</p>
            <p style={{ margin: '10px 0 0', color: '#888' }}>
              Players are now answering this clue.
            </p>
          </div>
        ) : (
          <p style={{ color: '#aaa' }}>Choose a clue to send the question to players.</p>
        )}
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>Player Answers</h2>
        {playerAnswers.length === 0 ? (
          <p style={{ color: '#888' }}>No answers have arrived yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {currentClueAnswers.map((answer) => (
              <div key={`${answer.id}-${answer.originalIndex}`} style={{ padding: '16px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <strong>{answer.name}</strong> answered for clue {answer.clueIndex + 1}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc' }}>
                    <input
                      type="checkbox"
                      checked={answer.accepted}
                      onChange={() => toggleAnswerAccepted(answer.originalIndex)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    Mark as correct
                  </label>
                </div>
                <p style={{ margin: '10px 0' }}>{answer.answer}</p>
              </div>
            ))}
            <button
              onClick={finalizeClueJudgement}
              disabled={currentClueAnswers.length === 0}
              style={{ backgroundColor: '#4CAF50', color: '#fff', border: 'none', padding: '14px 18px', borderRadius: '10px', cursor: currentClueAnswers.length === 0 ? 'not-allowed' : 'pointer', marginTop: '12px', alignSelf: 'flex-start' }}
            >
              Finalize Clue Outcome
            </button>
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
