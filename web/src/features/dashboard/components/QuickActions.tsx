import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShieldCheck, Settings, KeyIcon, CreditCard, StickyNote, History } from 'lucide-react';

export const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    { 
      label: 'Add Password', 
      icon: <KeyIcon size={20} />, 
      color: 'var(--color-security-blue)', 
      bgColor: 'var(--color-blue-subtle)',
      onClick: () => navigate('/vault?action=add&type=login')
    },
    { 
      label: 'Add Card', 
      icon: <CreditCard size={20} />, 
      color: 'var(--color-soft-green)', 
      bgColor: 'var(--color-emerald-subtle)',
      onClick: () => navigate('/vault?action=add&type=card')
    },
    { 
      label: 'New Note', 
      icon: <StickyNote size={20} />, 
      color: 'var(--color-amber)', 
      bgColor: 'var(--color-amber-subtle)',
      onClick: () => navigate('/vault?action=add&type=note')
    },

    { 
      label: 'Settings', 
      icon: <Settings size={20} />, 
      color: 'var(--color-text-subtle)', 
      bgColor: 'var(--color-soft-gray)',
      onClick: () => navigate('/settings')
    },
  ];

  return (
    <div className="quick-actions">
      <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--color-text-main)' }}>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={action.onClick}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '1.25rem',
              borderRadius: '1rem',
              backgroundColor: 'var(--color-white)',
              border: '1px solid var(--color-border)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              e.currentTarget.style.borderColor = action.color;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          >
            <div style={{ 
              width: '44px', 
              height: '44px', 
              borderRadius: '12px', 
              backgroundColor: action.bgColor, 
              color: action.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {action.icon}
            </div>
            <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-text-main)' }}>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
