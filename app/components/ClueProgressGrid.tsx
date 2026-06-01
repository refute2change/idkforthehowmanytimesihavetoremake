// app/components/ClueProgressGrid.tsx
interface ClueProgressState {
  clueIndex: number;
  length: number;
  status: 'available' | 'selected' | 'opened' | 'failed';
  answer?: string;
}

interface ClueProgressGridProps {
  progressList: ClueProgressState[];
}

export function ClueProgressGrid({ progressList }: ClueProgressGridProps) {
  return (
    <div style={{ display: 'flex', gap: '16px', marginBottom: '18px', flexDirection: 'column' }}>
      {progressList.map((progress) => {
        const isSelected = progress.status === 'selected';
        const isOpened = progress.status === 'opened';
        const isFailed = progress.status === 'failed';
        
        const backgroundColor = isFailed
          ? '#444'
          : isSelected || isOpened
          ? '#1fc7d4'
          : '#142b52';

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
                    color: '#fff',
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
  );
}