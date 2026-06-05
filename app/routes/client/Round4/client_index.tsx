// app/routes/client/Round4/client_index.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../../../components/SocketContext';
import { socket } from '../../../socket';
import { GameHeader } from '../../../components/GameHeader';
import { ActiveScoreBox } from '../../../components/ActiveScorebox';
import { Round4Roster } from '../../../components/Round4Roster';

interface Round4QuestionState {
  question: string;
  value: number;
  activePlayerId: string;
  activePlayerName: string;
  star: boolean;
  duration: number;
}

interface RoomPlayerSnapshot {
  id: string;
  name: string;
  points: number;
}

export default function ClientRound4() {
  const { isConnected, currentRoom } = useSocket();
  const navigate = useNavigate();

  const [turnStaged, setTurnStaged] = useState<boolean>(false);
  const [stagedActiveId, setStagedActiveId] = useState<string>('');
  const [chosenPackBlock, setChosenPackBlock] = useState<number | null>(null);
  const [showMainUI, setShowMainUI] = useState<boolean>(false);
  const [activatePlayerBarHighlight, setActivatePlayerBarHighlight] = useState<boolean>(false);
  const [starOfHopePreActivated, setStarOfHopePreActivated] = useState<boolean>(false);

  const [round4State, setRound4State] = useState<Round4QuestionState | null>(null);
  const [answerStatus, setAnswerStatus] = useState<string>('');
  const [stealStatus, setStealStatus] = useState<string>('');
  const [stealWindowOpen, setStealWindowOpen] = useState(false);
  const [stealAttempted, setStealAttempted] = useState(false);
  const [currentStealPlayerId, setCurrentStealPlayerId] = useState<string>('');
  const [roomLeaderboard, setRoomLeaderboard] = useState<RoomPlayerSnapshot[]>([]);
  
  const [answerWindowEnabled, setAnswerWindowEnabled] = useState(false);
  const [clientTimeLeft, setClientTimeLeft] = useState<number | null>(null);

  const amActivePlayer = useMemo(() => {
    const trackingId = round4State?.activePlayerId || stagedActiveId;
    return trackingId === (socket.id ?? '');
  }, [round4State, stagedActiveId]);

  const activePlayerScore = useMemo(() => {
    const activeId = round4State?.activePlayerId || stagedActiveId;
    if (!activeId) return 0;
    const activeUser = roomLeaderboard.find((p) => p.id === activeId);
    return activeUser ? activeUser.points : 0;
  }, [roomLeaderboard, round4State, stagedActiveId]);

  const strokeDashoffset = useMemo(() => {
    if (clientTimeLeft === null || !round4State || round4State.duration === 0) return 0;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    return circumference - (clientTimeLeft / round4State.duration) * circumference;
  }, [clientTimeLeft, round4State]);

  useEffect(() => {
    if (!isConnected || !currentRoom) navigate('/');
  }, [isConnected, currentRoom, navigate]);

  useEffect(() => {
    if (!showMainUI) {
      setActivatePlayerBarHighlight(false);
      return;
    }
    const highlightTimer = setTimeout(() => setActivatePlayerBarHighlight(true), 4000);
    return () => clearTimeout(highlightTimer);
  }, [showMainUI]);

  useEffect(() => {
    if (!isConnected || !currentRoom) return;

    const handleDedicatedStageTurn = (data: any) => {
      if (!data) return;
      setTurnStaged(true);
      setStagedActiveId(data.activePlayerId);
      setShowMainUI(false);
      setChosenPackBlock(null);
      setActivatePlayerBarHighlight(false);
      setStarOfHopePreActivated(false); 
    };

    const handleStartQuestion = (data: any) => {
      if (!data) return;
      if (data.question === 'pack-chosen') {
        setChosenPackBlock(data.clueIndex);
        setTimeout(() => { setTurnStaged(false); setShowMainUI(true); }, 1500);
        return;
      }
      if (data.question === 'star-hope-activated') {
        setStarOfHopePreActivated(true);
        setAnswerStatus('🌟 STAR OF HOPE DEPLOYED! Host is selecting the sub-question...');
        return;
      }

      const currentStarSetting = Boolean(data.star) || starOfHopePreActivated;
      setStarOfHopePreActivated(false);

      setRound4State({
        question: data.question || 'No question provided',
        value: data.value,
        activePlayerId: data.activePlayerId || stagedActiveId,
        activePlayerName: data.activePlayerName || 'Active player',
        star: currentStarSetting, 
        duration: data.duration || 15
      });
      
      setAnswerWindowEnabled(false);
      setClientTimeLeft(null);
      setAnswerStatus(currentStarSetting ? '🌟 STAR OF HOPE ACTIVE! Waiting for timer initiation...' : 'Question staged by host. Waiting for timer initiation...');
      setStealStatus('');
      setStealWindowOpen(false);
      setStealAttempted(false);
      setCurrentStealPlayerId(''); 
    };

    const handleLiveTimerStart = (data: any) => {
      const totalSecs = data && typeof data.duration === 'number' ? data.duration : 10;
      setRound4State((prev) => prev ? { ...prev, duration: totalSecs } : null);
      setClientTimeLeft(totalSecs);
      setAnswerWindowEnabled(true);
      setAnswerStatus(round4State?.star || starOfHopePreActivated ? '🌟 STAR OF HOPE IS RUNNING! Answer verbally.' : 'Timer is active! Answer verbally or prepare your thoughts.');
    };

    const handleStealFirst = (data: any) => {
      if (!data) return;
      setCurrentStealPlayerId(data.playerId);
      setStealStatus(`${data.playerName} buzzed in first! Waiting for host verbal verdict.`);
      if (data.playerId !== socket.id) setStealWindowOpen(false);
    };

    const handleAnswerResult = (data: any) => {
      if (!data) return;
      setAnswerStatus(data.correct ? `Verdict: Correct! ${data.message || ''}` : `Verdict: Incorrect. ${data.message || ''}`);
      setAnswerWindowEnabled(false);
      setClientTimeLeft(null);
    };

    const handleTurnOverTeardown = () => {
      setTurnStaged(false); setStagedActiveId(''); setChosenPackBlock(null); setShowMainUI(false);
      setActivatePlayerBarHighlight(false); setStarOfHopePreActivated(false); setRound4State(null);
      setClientTimeLeft(null); setAnswerStatus(''); setStealStatus('');
    };

    socket.on('round4-stage-turn', handleDedicatedStageTurn);
    socket.on('round4-start-question', handleStartQuestion);
    socket.on('reveal-question', handleStartQuestion); 
    socket.on('round4-start-timer', handleLiveTimerStart);
    socket.on('round4-open-steal-window', () => { setStealWindowOpen(true); setStealStatus('Steal window is live! Fast click to buzz in.'); });
    socket.on('round4-close-steal-window', () => { setStealWindowOpen(false); setStealStatus('Steal window closed.'); });
    socket.on('round4-steal-first', handleStealFirst);
    socket.on('round4-answer-result', handleAnswerResult);
    socket.on('round4-steal-result', (d: any) => { if (d) { setStealStatus(d.correct ? `Steal Complete! ${d.message || ''}` : `Steal Denied! ${d.message || ''}`); setStealWindowOpen(false); setStealAttempted(false); } });
    socket.on('room-leaderboard-snapshot', (d: any) => d && Array.isArray(d.leaderboard) && setRoomLeaderboard(d.leaderboard));
    socket.on('round4-turn-over', handleTurnOverTeardown);
    socket.on('terminate-game', () => navigate('/play'));
    socket.on('host-offline-evict', () => { navigate('/'); socket.emit('disconnect'); });

    socket.emit('request-room-leaderboard', { hostKey: currentRoom });

    return () => {
      socket.off('round4-stage-turn'); socket.off('round4-start-question'); socket.off('reveal-question');
      socket.off('round4-start-timer'); socket.off('round4-open-steal-window'); socket.off('round4-close-steal-window');
      socket.off('round4-steal-first'); socket.off('round4-answer-result'); socket.off('round4-steal-result');
      socket.off('room-leaderboard-snapshot'); socket.off('round4-turn-over'); socket.off('terminate-game'); socket.off('host-offline-evict');
    };
  }, [isConnected, currentRoom, navigate, stagedActiveId, round4State, showMainUI, starOfHopePreActivated]);

  useEffect(() => {
    const buzzerSound = new Audio('/sounds/Round4/buzzer.mp3'); // Ensure this file exists in your public folder
    const tenSec = new Audio('/sounds/Round4/10_second.ogg');
    const fifteenSec = new Audio('/sounds/Round4/15_second.ogg');
    const twentySec = new Audio('/sounds/Round4/20_second.ogg');
    const stealTimerSound = new Audio('/sounds/Round4/steal_window.mpeg');
    const selectPackSound = new Audio('/sounds/Round4/select_pack.mp3');
    const correct = new Audio('/sounds/Round4/correct.ogg');
    const wrong = new Audio('/sounds/Round4/wrong.ogg');

    const handlePlaySound = (data: { effect: string }) => {
      console.log(data.effect);
      if (data.effect === 'steal-buzzer') {
          // The promise returned by play() will reject if the browser blocks it
          buzzerSound.play().catch(err => {
            console.warn("Audio blocked by browser, waiting for interaction:", err);
          });
        }
      else if (data.effect === '10-second') tenSec.play().catch(() => {});
      else if (data.effect === '15-second') fifteenSec.play().catch(() => {});
      else if (data.effect === '20-second') twentySec.play().catch(() => {});
      else if (data.effect === 'steal-timer') stealTimerSound.play().catch(() => {});
      else if (data.effect === 'select-pack') selectPackSound.play().catch(() => {});
      else if (data.effect === 'correct') correct.play().catch(() => {});
      else if (data.effect === 'wrong') wrong.play().catch(() => {});
        else console.log("Unknown sound effect requested:", data.effect);
      };

    socket.on('play-sound-effect', handlePlaySound);

    return () => {
      socket.off('play-sound-effect', handlePlaySound);
    };
  }, []);

  useEffect(() => {
    if (!answerWindowEnabled || clientTimeLeft === null || clientTimeLeft <= 0) return;
    const intervalId = window.setInterval(() => {
      setClientTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) { setAnswerWindowEnabled(false); setAnswerStatus('Time expired! Host evaluation pending.'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [answerWindowEnabled]);

  const sendStealAttempt = () => {
    if (!currentRoom || amActivePlayer || stealAttempted || !stealWindowOpen) return;
    socket.emit('round4-steal-attempt', { hostKey: currentRoom });
    setStealAttempted(true); setStealStatus('Buzzing server...');
  };

  const isStarActive = round4State?.star || starOfHopePreActivated;

  if (!isConnected || !currentRoom) return <div style={{ color: '#fff', padding: '20px' }}>Connecting to Round4...</div>;

  return (
    <div style={{ padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <GameHeader title="Player Round 4 Screen" subTitle={isStarActive ? '🌟 [STAR OF HOPE TURN]' : undefined} />

      {!turnStaged && !showMainUI && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#666', fontSize: '1.25rem', fontStyle: 'italic', border: '2px dashed #222', borderRadius: '12px' }}>
          Standby Mode. Waiting for game host to assign active player sequence...
        </div>
      )}

      {turnStaged && !showMainUI && (
        <div>
          <h2>Round 4: Select Point Package Group</h2>
          <div style={{ display: 'flex', gap: '20px', marginTop: '40px', height: '50vh' }}>
            {[40, 60, 80].map((val) => {
              const isTargetLit = chosenPackBlock === val;
              return (
                <div key={val} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: isTargetLit ? '#1fc7d4' : '#1e1e1e', color: isTargetLit ? '#000' : '#fff', border: isTargetLit ? '4px solid #fff' : '2px solid #333', borderRadius: '16px', fontSize: '2.5rem', fontWeight: 'bold', boxShadow: isTargetLit ? '0 0 30px #1fc7d4' : 'none', transition: 'all 0.25s' }}>
                  {val} <span style={{ fontSize: '1.1rem', marginTop: '10px', opacity: 0.7 }}>POINTS POOL</span>
                  {isTargetLit && <span style={{ fontSize: '1rem', color: '#000', marginTop: '15px', backgroundColor: '#fff', padding: '4px 10px', borderRadius: '4px' }}>LOCKED IN!</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showMainUI && (
        <>
          <section style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
            <Round4Roster players={roomLeaderboard} activeId={round4State?.activePlayerId || stagedActiveId} stealId={currentStealPlayerId} highlightActive={activatePlayerBarHighlight} />
            <ActiveScoreBox score={activePlayerScore} highlightActive={activatePlayerBarHighlight} isStarActive={isStarActive} />
          </section>

          <section style={{ marginBottom: '24px' }}>
            <div style={{ padding: '18px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px' }}>
              <p style={{ margin: 0, color: '#aaa' }}>Target Active Panelist: <strong style={{ color: '#ffb703' }}>{round4State?.activePlayerName}</strong> ({isStarActive ? `${round4State?.value} × 2` : `${round4State?.value}`} Points)</p>
              <p style={{ margin: '10px 0 0', fontSize: '1.4rem', lineHeight: '1.5', fontWeight: '500' }}>{round4State?.question}</p>
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            <div style={{ backgroundColor: '#181818', borderRadius: '12px', border: '1px solid #333', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px', color: amActivePlayer ? '#ffb703' : '#fff' }}>{amActivePlayer ? "🔴 YOUR TURNTABLE TIME" : "Question Timer"}</h3>
              {clientTimeLeft !== null ? (
                <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                  <svg style={{ transform: 'rotate(-90deg)', width: '120px', height: '120px' }}>
                    <circle cx="60" cy="60" r="50" stroke="#222" strokeWidth="8" fill="transparent" />
                    <circle cx="60" cy="60" r="50" stroke={clientTimeLeft <= 3 ? '#f44336' : (isStarActive ? '#ffb703' : '#1fc7d4')} strokeWidth="8" fill="transparent" strokeDasharray={`${2 * Math.PI * 50}`} strokeDashoffset={strokeDashoffset} style={{ transition: 'stroke-dashoffset 1s linear' }} />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold' }}>{clientTimeLeft}s</div>
                </div>
              ) : <div style={{ textTransform: 'uppercase', fontSize: '0.9rem', color: '#666', border: '2px dashed #333', padding: '20px 40px', borderRadius: '8px' }}>Timer Standby</div>}
              <p style={{ marginTop: '20px', color: isStarActive ? '#ffb703' : '#1fc7d4', fontWeight: '500' }}>{answerStatus}</p>
            </div>

            <div style={{ backgroundColor: '#181818', borderRadius: '12px', border: '1px solid #333', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: !amActivePlayer ? 1 : 0.4 }}>
              <h3>Reflexive Steal Buzzer</h3>
              <button onClick={sendStealAttempt} disabled={!round4State || !stealWindowOpen || stealAttempted || amActivePlayer} style={{ width: '100%', padding: '30px 24px', fontSize: '1.4rem', fontWeight: 'bold', backgroundColor: !round4State || !stealWindowOpen || stealAttempted || amActivePlayer ? '#333' : '#8E24AA', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                {stealAttempted ? 'BUZZED IN!' : '💥 ATTEMPT STEAL 💥'}
              </button>
              <p style={{ marginTop: '16px', color: '#ffb703', textAlign: 'center', fontWeight: 'bold' }}>{stealStatus}</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}