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
  duration: number;
}

interface RoomPlayerSnapshot {
  id: string;
  name: string;
  points: number;
}

export default function ClientRound4() {
  const { isConnected, currentRoom, disconnectSocket } = useSocket();
  const navigate = useNavigate();

  // Framework Pipeline Workflow States
  const [turnStaged, setTurnStaged] = useState<boolean>(false);
  const [stagedActiveId, setStagedActiveId] = useState<string>('');
  const [chosenPackBlock, setChosenPackBlock] = useState<number | null>(null);
  const [showMainUI, setShowMainUI] = useState<boolean>(false);
  const [activatePlayerBarHighlight, setActivatePlayerBarHighlight] = useState<boolean>(false);

  // Star of Hope Isolated Prep State
  const [starOfHopePreActivated, setStarOfHopePreActivated] = useState<boolean>(false);

  // Core Game State Variables
  const [round4State, setRound4State] = useState<Round4QuestionState | null>(null);
  const [answerStatus, setAnswerStatus] = useState<string>('');
  const [stealStatus, setStealStatus] = useState<string>('');
  const [stealWindowOpen, setStealWindowOpen] = useState(false);
  const [stealAttempted, setStealAttempted] = useState(false);
  const [currentStealPlayerId, setCurrentStealPlayerId] = useState<string>('');
  
  // Static Ordered Player Roster List Array Matrix
  const [roomLeaderboard, setRoomLeaderboard] = useState<RoomPlayerSnapshot[]>([]);
  
  // Timer Display States
  const [answerWindowEnabled, setAnswerWindowEnabled] = useState(false);
  const [clientTimeLeft, setClientTimeLeft] = useState<number | null>(null);

  // Identity Check Memo
  const amActivePlayer = useMemo(() => {
    const trackingId = round4State?.activePlayerId || stagedActiveId;
    return trackingId === (socket.id ?? '');
  }, [round4State, stagedActiveId]);

  // Derived score helper to find the active player's point value dynamically
  const activePlayerScore = useMemo(() => {
    const activeId = round4State?.activePlayerId || stagedActiveId;
    if (!activeId) return 0;
    const activeUser = roomLeaderboard.find((p) => p.id === activeId);
    return activeUser ? activeUser.points : 0;
  }, [roomLeaderboard, round4State, stagedActiveId]);

  // Dynamic values for the visual SVG countdown circle progress
  const strokeDashoffset = useMemo(() => {
    if (clientTimeLeft === null || !round4State || round4State.duration === 0) return 0;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    return circumference - (clientTimeLeft / round4State.duration) * circumference;
  }, [clientTimeLeft, round4State]);

  // Route Security Guard Redirect
  useEffect(() => {
    if (!isConnected || !currentRoom) {
      navigate('/');
    }
  }, [isConnected, currentRoom, navigate]);

  // ==========================================
  // TIMING HOOK: TRIGGER HIGHLIGHT 4S AFTER UI SHOWS
  // ==========================================
  useEffect(() => {
    if (!showMainUI) {
      setActivatePlayerBarHighlight(false);
      return;
    }

    const highlightTimer = setTimeout(() => {
      setActivatePlayerBarHighlight(true);
    }, 4000);

    return () => clearTimeout(highlightTimer);
  }, [showMainUI]);


  // ==========================================
  // HOOK 1: NETWORK EVENT LISTENER SOCKET HUB
  // ==========================================
  useEffect(() => {
    if (!isConnected || !currentRoom) return;

    const handleOpenRound4 = () => {
      navigate('/play/round4');
    };

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
        const packVal = data.clueIndex;
        setChosenPackBlock(packVal);
        
        setTimeout(() => {
          setTurnStaged(false);
          setShowMainUI(true);
        }, 3000);
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
      setAnswerStatus(currentStarSetting
        ? '🌟 STAR OF HOPE ACTIVE! Waiting for timer initiation...'
        : 'Question staged by host. Waiting for timer initiation...');
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
      setAnswerStatus(round4State?.star || starOfHopePreActivated
        ? '🌟 STAR OF HOPE IS RUNNING! Answer verbally.'
        : 'Timer is active! Answer verbally or prepare your thoughts.');
    };

    const handleOpenStealWindow = () => {
      setStealWindowOpen(true);
      setStealStatus('Steal window is live! Fast click to buzz in.');
    };

    const handleCloseStealWindow = () => {
      setStealWindowOpen(false);
      setStealStatus('Steal window closed.');
    };

    const handleStealFirst = (data: any) => {
      if (!data) return;
      setCurrentStealPlayerId(data.playerId);
      setStealStatus(`${data.playerName} buzzed in first! Waiting for host verbal verdict.`);
      if (data.playerId !== socket.id) {
        setStealWindowOpen(false);
      }
    };

    const handleAnswerResult = (data: any) => {
      if (!data) return;
      setAnswerStatus(data.correct ? `Verdict: Correct! ${data.message || ''}` : `Verdict: Incorrect. ${data.message || ''}`);
      setAnswerWindowEnabled(false);
      setClientTimeLeft(null);
    };

    const handleStealResult = (data: any) => {
      if (!data) return;
      setStealStatus(data.correct ? `Steal Complete! ${data.message || ''}` : `Steal Denied! ${data.message || ''}`);
      setStealWindowOpen(false);
      setStealAttempted(false);
    };

    const handleLeaderboardSnapshot = (data: any) => {
      if (data && Array.isArray(data.leaderboard)) {
        setRoomLeaderboard(data.leaderboard);
      }
    };

    const handleTurnOverTeardown = () => {
      setTurnStaged(false);
      setStagedActiveId('');
      setChosenPackBlock(null);
      setShowMainUI(false);
      setActivatePlayerBarHighlight(false);
      setStarOfHopePreActivated(false);
      setRound4State(null);
      setClientTimeLeft(null);
      setAnswerStatus('');
      setStealStatus('');
    };

    const handleGameTerminateTeardown = () => {
      navigate('/play');
    };

    // FIX ADDITION: Evict player to "/" and fully disconnect local socket when the host goes offline
    const handleHostOfflineEviction = () => {
      console.warn("Round 4 terminated: Host server dropped offline.");
      navigate('/');
      if (disconnectSocket) {
        disconnectSocket();
      }
    };

    socket.on('open-round4', handleOpenRound4);
    socket.on('round4-stage-turn', handleDedicatedStageTurn);
    socket.on('round4-start-question', handleStartQuestion);
    socket.on('reveal-question', handleStartQuestion); 
    socket.on('round4-start-timer', handleLiveTimerStart);
    socket.on('round4-open-steal-window', handleOpenStealWindow);
    socket.on('round4-close-steal-window', handleCloseStealWindow);
    socket.on('round4-steal-first', handleStealFirst);
    socket.on('round4-answer-result', handleAnswerResult);
    socket.on('round4-steal-result', handleStealResult);
    socket.on('room-leaderboard-snapshot', handleLeaderboardSnapshot);
    socket.on('round4-turn-over', handleTurnOverTeardown);
    socket.on('terminate-game', handleGameTerminateTeardown);
    socket.on('host-offline-evict', handleHostOfflineEviction);

    socket.emit('request-room-leaderboard', { hostKey: currentRoom });

    return () => {
      socket.off('open-round4', handleOpenRound4);
      socket.off('round4-stage-turn', handleDedicatedStageTurn);
      socket.off('round4-start-question', handleStartQuestion);
      socket.off('reveal-question', handleStartQuestion);
      socket.off('round4-start-timer', handleLiveTimerStart);
      socket.off('round4-open-steal-window', handleOpenStealWindow);
      socket.off('round4-close-steal-window', handleCloseStealWindow);
      socket.off('round4-steal-first', handleStealFirst);
      socket.off('round4-answer-result', handleAnswerResult);
      socket.off('round4-steal-result', handleStealResult);
      socket.off('room-leaderboard-snapshot', handleLeaderboardSnapshot);
      socket.off('round4-turn-over', handleTurnOverTeardown);
      socket.off('terminate-game', handleGameTerminateTeardown);
      socket.off('host-offline-evict', handleHostOfflineEviction);
    };
  }, [isConnected, currentRoom, navigate, stagedActiveId, round4State, showMainUI, starOfHopePreActivated, disconnectSocket]); 

  // ==========================================
  // HOOK 2: ISOLATED CLOCK COUNTDOWN CONTROLLER
  // ==========================================
  useEffect(() => {
    if (!answerWindowEnabled || clientTimeLeft === null || clientTimeLeft <= 0) return;

    const intervalId = window.setInterval(() => {
      setClientTimeLeft((prevTime) => {
        if (prevTime === null) return null;
        if (prevTime <= 1) {
          setAnswerWindowEnabled(false);
          setAnswerStatus('Time expired! Host evaluation pending.');
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [answerWindowEnabled]);

  const sendStealAttempt = () => {
    if (!currentRoom || amActivePlayer || stealAttempted || !stealWindowOpen) return;
    socket.emit('round4-steal-attempt', { hostKey: currentRoom });
    setStealAttempted(true);
    setStealStatus('Buzzing server...');
  };

  if (!isConnected || !currentRoom) {
    return <div style={{ color: '#fff', padding: '20px' }}>Connecting to Round4...</div>;
  }

  const isStarActive = round4State?.star || starOfHopePreActivated;

  return (
    <div style={{ padding: '20px', color: '#fff', backgroundColor: '#121212', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* GLOBAL FIXED HEADER SECTION: Never hidden regardless of state parameters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Player Round 4 Screen {isStarActive && <span style={{ color: '#ffb703', marginLeft: '10px' }}>🌟 [STAR OF HOPE TURN]</span>}</h1>
          <p>Room: <span style={{ color: '#4CAF50', fontFamily: 'monospace' }}>{currentRoom}</span></p>
        </div>
        <button onClick={disconnectSocket} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '4px', cursor: 'pointer' }}>Leave Room</button>
      </div>

      <hr style={{ borderColor: '#333', margin: '20px 0' }} />

      {/* ========================================== */}
      {/* RENDER PATHWAY 1: BLANK STANDBY COMPONENT VIEW */}
      {/* ========================================== */}
      {!turnStaged && !showMainUI && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#666', fontSize: '1.25rem', fontStyle: 'italic', border: '2px dashed #222', borderRadius: '12px' }}>
          Standby Mode. Waiting for game host to assign active player sequence...
        </div>
      )}

      {/* ========================================== */}
      {/* RENDER PATHWAY 2: 3 GIANT PACKAGE CHOICE BLOCKS */}
      {/* ========================================== */}
      {turnStaged && !showMainUI && (
        <div>
          <h2>Round 4: Select Point Package Group</h2>
          <p style={{ color: '#888' }}>Host is choosing one of the available pools for the current active turn profile.</p>
          <div style={{ display: 'flex', gap: '20px', marginTop: '40px', height: '50vh' }}>
            {[40, 60, 80].map((val) => {
              const isTargetLit = chosenPackBlock === val;
              return (
                <div
                  key={val}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isTargetLit ? '#1fc7d4' : '#1e1e1e',
                    color: isTargetLit ? '#000' : '#fff',
                    border: isTargetLit ? '4px solid #fff' : '2px solid #333',
                    borderRadius: '16px', fontSize: '2.5rem', fontWeight: 'bold',
                    boxShadow: isTargetLit ? '0 0 30px #1fc7d4' : 'none',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  {val}
                  <span style={{ fontSize: '1.1rem', marginTop: '10px', opacity: 0.7 }}>POINTS POOL</span>
                  {isTargetLit && <span style={{ fontSize: '1rem', color: '#000', marginTop: '15px', backgroundColor: '#fff', padding: '4px 10px', borderRadius: '4px' }}>LOCKED IN!</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* RENDER PATHWAY 3: MAIN ROUND QUESTION DASHBOARD BOARD VIEW */}
      {/* ========================================== */}
      {showMainUI && (
        <>
          {/* Roster Row Container Layout */}
          <section style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {roomLeaderboard.map((player) => {
                const isActive = activatePlayerBarHighlight && (round4State?.activePlayerId === player.id || stagedActiveId === player.id);
                const isStealing = currentStealPlayerId === player.id;

                let backgroundColor = '#1e1e1e';
                let textColor = '#aaa';
                let fontWeight = 'normal';
                let borderStyle = '1px solid #333';

                if (isActive) {
                  backgroundColor = '#fff';      
                  textColor = '#000';            
                  fontWeight = 'bold';           
                  borderStyle = '1px solid #fff';
                } else if (isStealing) {
                  backgroundColor = '#8E24AA';   
                  textColor = '#fff';            
                  fontWeight = 'normal';         
                  borderStyle = '1px solid #b76ed8';
                }

                return (
                  <div
                    key={player.id}
                    style={{
                      padding: '10px 16px', borderRadius: '6px', backgroundColor, color: textColor, fontWeight, border: borderStyle,
                      display: 'flex', alignItems: 'center', fontSize: '0.95rem', transition: 'all 0.3s ease',
                      boxShadow: isStealing ? '0 0 10px #8E24AA' : 'none'
                    }}
                  >
                    <span>{player.name}</span>
                    {!isActive && (
                      <span style={{ marginLeft: '6px', opacity: isStealing ? 0.9 : 0.6 }}>
                        ({player.points} pts)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right Side: FIXED SIZE Active Score Panel (Cleaned up down to only the massive centered point total number) */}
            <div
              style={{
                width: '150px',             // Locked boundaries layout matching image specifications
                height: '125px',            // Locked boundaries layout matching image specifications
                borderRadius: '12px',
                backgroundColor: activatePlayerBarHighlight ? '#141414' : 'transparent',
                border: activatePlayerBarHighlight 
                  ? (isStarActive ? '2px solid #ffb703' : '1px solid #4CAF50') 
                  : '1px dashed #2b2b2b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: (activatePlayerBarHighlight && isStarActive) ? '0 0 15px rgba(255, 183, 3, 0.25)' : 'none',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {activatePlayerBarHighlight ? (
                <div style={{ color: isStarActive ? '#ffb703' : '#4CAF50', fontSize: '4.5rem', fontWeight: 'bold', lineHeight: '1' }}>
                  {activePlayerScore}
                </div>
              ) : null}
            </div>
          </section>

          {/* Question Context Card Section */}
          <section style={{ marginBottom: '24px' }}>
            <div style={{ padding: '18px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '10px' }}>
              {round4State ? (
                <>
                  <p style={{ margin: 0, color: '#aaa' }}>
                    Target Active Panelist: <strong style={{ color: '#ffb703' }}>{round4State.activePlayerName}</strong> ({isStarActive ? `${round4State.value} × 2 Dynamic Star` : `${round4State.value}`} Points)
                  </p>
                  <p style={{ margin: '10px 0 0', fontSize: '1.4rem', lineHeight: '1.5', fontWeight: '500' }}>{round4State.question}</p>
                </>
              ) : (
                <p style={{ margin: 0, color: '#888', fontStyle: 'italic' }}>
                  Awaiting Host selection initialization sync...
                </p>
              )}
            </div>
          </section>

          {/* Workspace Panels Row Grid */}
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            
            {/* Left Side Question Countdown Clock */}
            <div style={{ backgroundColor: '#181818', borderRadius: '12px', border: '1px solid #333', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px', color: amActivePlayer ? '#ffb703' : '#fff' }}>
                {amActivePlayer ? "🔴 YOUR TURNTABLE TIME" : "Question Timer"}
              </h3>
              
              {clientTimeLeft !== null ? (
                <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                  <svg style={{ transform: 'rotate(-90deg)', width: '120px', height: '120px' }}>
                    <circle cx="60" cy="60" r="50" stroke="#222" strokeWidth="8" fill="transparent" />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      stroke={clientTimeLeft <= 3 ? '#f44336' : (isStarActive ? '#ffb703' : '#1fc7d4')}
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 50}`}
                      strokeDashoffset={strokeDashoffset}
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', color: isStarActive ? '#ffb703' : '#fff' }}>
                    {clientTimeLeft}s
                  </div>
                </div>
              ) : (
                <div style={{ textTransform: 'uppercase', fontSize: '0.9rem', color: '#666', border: '2px dashed #333', padding: '20px 40px', borderRadius: '8px', letterSpacing: '1px' }}>
                  Timer Standby
                </div>
              )}
              
              <p style={{ marginTop: '20px', color: isStarActive ? '#ffb703' : '#1fc7d4', fontWeight: '500', textAlign: 'center', margin: '20px 0 0' }}>{answerStatus}</p>
            </div>

            {/* Right Side Steal Quick Buzzer Panel */}
            <div style={{ backgroundColor: '#181818', borderRadius: '12px', border: '1px solid #333', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: !amActivePlayer ? 1 : 0.4 }}>
              <div>
                <h3>Reflexive Steal Buzzer</h3>
                <p style={{ color: '#888', margin: '0 0 20px' }}>If the active player gets marked incorrect by the game administrator, this option turns hot. Hit the panel immediately to claim points!</p>
              </div>
              
              <div>
                <button
                  onClick={sendStealAttempt}
                  disabled={!round4State || !stealWindowOpen || stealAttempted || amActivePlayer}
                  style={{
                    width: '100%', padding: '30px 24px', fontSize: '1.4rem', fontWeight: 'bold',
                    backgroundColor: !round4State || !stealWindowOpen || stealAttempted || amActivePlayer ? '#333' : '#8E24AA',
                    color: !round4State || !stealWindowOpen || stealAttempted || amActivePlayer ? '#666' : '#fff',
                    border: 'none', borderRadius: '8px', boxShadow: stealWindowOpen ? '0 0 20px #8E24AA' : 'none',
                    cursor: !round4State || !stealWindowOpen || stealAttempted || amActivePlayer ? 'not-allowed' : 'pointer',
                    transition: '0.2s all'
                  }}
                >
                  {stealAttempted ? 'BUZZED IN!' : '💥 ATTEMPT STEAL 💥'}
                </button>
                <p style={{ marginTop: '16px', color: '#ffb703', textAlign: 'center', fontWeight: 'bold', marginBottom: 0 }}>{stealStatus}</p>
              </div>
            </div>

          </section>
        </>
      )}
    </div>
  );
}