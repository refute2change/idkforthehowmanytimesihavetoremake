// app/components/Round4Roster.tsx
interface RosterPlayer {
  id: string;
  name: string;
  points: number;
}

interface Round4RosterProps {
  players: RosterPlayer[];
  activeId: string;
  stealId: string;
  highlightActive: boolean;
}

export function Round4Roster({ players, activeId, stealId, highlightActive }: Round4RosterProps) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {players.map((player) => {
        const isActive = highlightActive && player.id === activeId;
        const isStealing = player.id === stealId;

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
  );
}