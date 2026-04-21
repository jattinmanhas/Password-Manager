import React from 'react';

interface SecurityScoreGaugeProps {
  score: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
}

export const SecurityScoreGauge: React.FC<SecurityScoreGaugeProps> = ({ 
  score, 
  size = 120, 
  strokeWidth = 10 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  
  const getColor = (s: number) => {
    if (s >= 80) return 'var(--color-soft-green)';
    if (s >= 50) return 'var(--color-amber)';
    return 'var(--color-red)';
  };

  return (
    <div className="security-gauge-wrapper" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block', width: '100%', height: '100%' }}>
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeOpacity="0.3"
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          style={{ 
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.5s ease'
          }}
          strokeLinecap="round"
        />
      </svg>
      <div 
        className="security-gauge-label" 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%'
        }}
      >
        <span style={{ fontSize: '1.25rem', fontWeight: '800', color: getColor(score), lineHeight: 1 }}>{score}%</span>
        <span style={{ fontSize: '0.625rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Health</span>
      </div>
    </div>
  );
};
