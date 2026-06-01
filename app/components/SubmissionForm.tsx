// app/components/SubmissionForm.tsx
interface SubmissionFormProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder: string;
  buttonText: string;
}

export function SubmissionForm({ value, onChange, onSubmit, disabled, placeholder, buttonText }: SubmissionFormProps) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (!disabled) onSubmit();
          }
        }}
        disabled={disabled}
        style={{ flex: 1, minWidth: '240px', padding: '12px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1e1e1e', color: '#fff' }}
      />
      <button 
        onClick={onSubmit} 
        disabled={disabled} 
        style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: !disabled ? '#4CAF50' : '#555', color: '#fff', border: 'none', cursor: !disabled ? 'pointer' : 'not-allowed' }}
      >
        {buttonText}
      </button>
    </div>
  );
}