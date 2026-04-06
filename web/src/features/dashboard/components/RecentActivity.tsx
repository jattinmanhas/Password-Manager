import React from 'react';
import { AuditEvent } from '../services/audit.service';
import { LogIn, Key, Shield, UserPlus, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecentActivityProps {
  events: AuditEvent[];
  isLoading: boolean;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ events, isLoading }) => {
  const navigate = useNavigate();
  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'login':
      case 'auth.login':
        return <LogIn size={16} />;
      case 'vault.create':
      case 'vault.update':
      case 'vault.delete':
        return <Key size={16} />;
      case 'totp.enable':
      case 'totp.disable':
        return <Shield size={16} />;
      case 'family.invite':
        return <UserPlus size={16} />;
      default:
        return <AlertTriangle size={16} />;
    }
  };

  const getEventLabel = (type: string) => {
    return type
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="recent-activity-loading" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-subtle)', fontSize: '0.875rem' }}>Loading activity...</p>
      </div>
    );
  }

  return (
    <div className="recent-activity">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-text-main)', margin: 0 }}>Recent Activity</h2>
        <button 
          onClick={() => navigate('/activity')}
          style={{ 
            fontSize: '0.75rem', 
            fontWeight: '600', 
            color: 'var(--color-security-blue)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-blue-subtle)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          View Audit Log
        </button>
      </div>
      <div 
        style={{ 
          backgroundColor: 'var(--color-white)', 
          border: '1px solid var(--color-border)', 
          borderRadius: '1rem',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden'
        }}
      >
        {events.length === 0 ? (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
             <p style={{ color: 'var(--color-text-subtle)', fontSize: '0.875rem' }}>No recent activity to show.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {events.slice(0, 5).map((event, idx) => (
              <div 
                key={event.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  padding: '1rem 1.5rem',
                  borderBottom: idx === events.slice(0, 5).length - 1 ? 'none' : '1px solid var(--color-border)',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-base)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '8px', 
                  backgroundColor: 'var(--color-soft-gray)', 
                  color: 'var(--color-text-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {getIcon(event.event_type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-main)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getEventLabel(event.event_type)}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', margin: 0 }}>
                    {event.event_data?.details || 'System event'}
                  </p>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>
                  {getTimeAgo(event.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
