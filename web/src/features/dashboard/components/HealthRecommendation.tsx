import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

interface HealthRecommendationProps {
  weakPasswords: number;
  reusedPasswords: number;
  sensitiveNotes: number;
  corruptedItems: number;
}

export const HealthRecommendation: React.FC<HealthRecommendationProps> = ({
  weakPasswords,
  reusedPasswords,
  sensitiveNotes,
  corruptedItems,
}) => {
  const navigate = useNavigate();

  const hasIssues = weakPasswords > 0 || reusedPasswords > 0 || sensitiveNotes > 0 || corruptedItems > 0;

  if (!hasIssues) return null;

  return (
    <div style={{ 
      marginTop: '2.5rem', 
      padding: '1.25rem', 
      borderRadius: '1rem', 
      backgroundColor: 'var(--color-rose-subtle)',
      border: '1px solid rgba(244, 63, 94, 0.1)'
    }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--color-rose)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Shield size={16} /> Security Recommendation
      </h3>
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-main)', marginBottom: '1rem' }}>
        {corruptedItems > 0
          ? `You have ${corruptedItems} corrupted vault item${corruptedItems === 1 ? '' : 's'} that should be reviewed first.`
          : reusedPasswords > 0
            ? `You have ${reusedPasswords} reused password group${reusedPasswords === 1 ? '' : 's'} in your vault.`
            : sensitiveNotes > 0
                ? `You have ${sensitiveNotes} note${sensitiveNotes === 1 ? '' : 's'} that may contain sensitive secrets.`
                : `You have ${weakPasswords} weak password${weakPasswords === 1 ? '' : 's'} in your vault.`}
      </p>
      <button 
        className="btn-primary" 
        style={{ height: '2.25rem', fontSize: '0.75rem', width: 'auto', padding: '0 1rem' }}
        onClick={() => navigate('/vault?filter=weak')}
      >
        Resolve Now
      </button>
    </div>
  );
};
