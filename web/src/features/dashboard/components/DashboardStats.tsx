import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Shield, ShieldAlert, Key, Clock, Lock, Share2, StickyNote, AlertTriangle, LockOpen } from 'lucide-react';
import { SecurityScoreGauge } from './SecurityScoreGauge';
import type { SecurityHealthBreakdown } from '../dashboard.utils';
import { Button } from '../../../components/ui/Button';

interface DashboardStatsProps {
  totalItems: number;
  securityScore: number;
  weakPasswords: number;
  reusedPasswords: number;
  recentActivityCount: number;
  sharedItems: number;
  sensitiveNotes: number;
  corruptedItems: number;
  breakdown: SecurityHealthBreakdown;
  isLocked?: boolean;
  onUnlockVault?: () => void;
  onLockVault?: () => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  totalItems,
  securityScore,
  weakPasswords,
  reusedPasswords,
  recentActivityCount,
  sharedItems,
  sensitiveNotes,
  corruptedItems,
  breakdown,
  isLocked = false,
  onUnlockVault,
  onLockVault,
}) => {
  return (
    <div className="dashboard-stats-container" style={{ marginBottom: '2.5rem' }}>
      {/* Featured Security Health Card */}
      <Card className="flex-responsive dashboard-health-card" style={{ 
        marginBottom: '1.5rem',
        padding: '1.5rem 2rem'
      }}>
        <div className="flex-responsive dashboard-health-info" style={{ flex: '1 1 auto' }}>
          <div className="dashboard-health-gauge" style={{ marginRight: '1rem' }}>
            <SecurityScoreGauge score={isLocked ? 0 : securityScore} size={110} strokeWidth={10} />
          </div>
          <div className="dashboard-health-copy">
            <div className="dashboard-health-label-wrap" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
              <Shield size={20} color="var(--color-security-blue)" />
              <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--color-text-subtle)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Overall Security Health
              </h3>
            </div>
            <p className="dashboard-health-status">
              {isLocked ? 'Vault Encrypted' : (securityScore >= 80 ? 'Excellent Protection' : securityScore >= 50 ? 'Fair Security' : 'Security Risk Detected')}
            </p>
            <p className="dashboard-health-desc">
              {isLocked 
                ? 'Your vault is currently locked. Unlock to view security metrics.' 
                : (securityScore >= 80 
                    ? 'Your score reflects password hygiene, sharing exposure, and vault integrity.'
                    : 'This score covers account posture, password hygiene, and vault integrity.')}
            </p>
          </div>
        </div>

        <div className="dashboard-health-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '260px' }}>
          {!isLocked ? (
            <>
              <div style={{ padding: '0.75rem', borderRadius: '10px', backgroundColor: 'var(--color-emerald-subtle)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="dashboard-health-action-status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                  <LockOpen size={14} color="var(--color-soft-green)" />
                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--color-soft-green)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Unlocked
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onLockVault}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Lock Vault
                </Button>
              </div>
              <div className="dashboard-mini-grid">
                <div className="dashboard-mini-metric-item" style={{ backgroundColor: weakPasswords > 0 ? 'var(--color-rose-subtle)' : 'var(--color-emerald-subtle)' }}>
                  <ShieldAlert size={14} color={weakPasswords > 0 ? 'var(--color-rose)' : 'var(--color-soft-green)'} />
                  <span className="dashboard-mini-metric-label">
                    {weakPasswords} <span className="mobile-hide">Weak</span><span className="mobile-show">W</span>
                  </span>
                </div>
                <div className="dashboard-mini-metric-item" style={{ backgroundColor: reusedPasswords > 0 ? 'var(--color-amber-subtle)' : 'var(--color-emerald-subtle)' }}>
                  <Shield size={14} color={reusedPasswords > 0 ? 'var(--color-amber)' : 'var(--color-soft-green)'} />
                  <span className="dashboard-mini-metric-label">
                    {reusedPasswords} <span className="mobile-hide">Reused</span><span className="mobile-show">R</span>
                  </span>
                </div>
                <div className="dashboard-mini-metric-item" style={{ backgroundColor: corruptedItems > 0 ? 'var(--color-rose-subtle)' : 'var(--color-emerald-subtle)' }}>
                  <AlertTriangle size={14} color={corruptedItems > 0 ? 'var(--color-rose)' : 'var(--color-soft-green)'} />
                  <span className="dashboard-mini-metric-label">
                    {corruptedItems} <span className="mobile-hide">Corrupt</span><span className="mobile-show">C</span>
                  </span>
                </div>
                <div className="dashboard-mini-metric-item" style={{ backgroundColor: sharedItems > 0 ? 'var(--color-amber-subtle)' : 'var(--color-emerald-subtle)' }}>
                  <Share2 size={14} color={sharedItems > 0 ? 'var(--color-amber)' : 'var(--color-soft-green)'} />
                  <span className="dashboard-mini-metric-label">
                    {sharedItems} <span className="mobile-hide">Shared</span><span className="mobile-show">S</span>
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '0.75rem', borderRadius: '10px', border: '1px dashed var(--color-border)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                  <Lock size={14} color="var(--color-amber)" />
                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--color-amber)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Locked
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-subtle)', lineHeight: 1.2 }}>
                  Unlock to view detailed health
                </div>
              </div>
              <Button
                type="button"
                onClick={onUnlockVault}
                size="sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Unlock Vault
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* 3-Column Stats Grid */}
      <div className="dashboard-stats-grid grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
        {/* Total Items Card */}
        <Card className="dashboard-metric-card" style={{ padding: '1.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 className="dashboard-metric-title">Vault Items</h3>
              <p className="dashboard-metric-value dashboard-metric-value--blue">
                {isLocked ? '---' : totalItems}
              </p>
              <p className="dashboard-metric-desc">
                {isLocked ? 'Vault is locked' : 'Secrets encrypted'}
              </p>
            </div>
            <div className="dashboard-metric-icon dashboard-metric-icon--blue">
              <Key size={20} />
            </div>
          </div>
        </Card>

        {/* Activity Stats Card */}
        <Card className="dashboard-metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 className="dashboard-metric-title">Activity (24h)</h3>
              <p className="dashboard-metric-value dashboard-metric-value--green">{recentActivityCount}</p>
              <p className="dashboard-metric-desc mobile-hide">Security events recorded</p>
            </div>
            <div className="dashboard-metric-icon dashboard-metric-icon--green">
              <Clock size={20} />
            </div>
          </div>
        </Card>
        
        {/* Sharing Exposure Card */}
        <Card className="dashboard-metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 className="dashboard-metric-title">Exposure</h3>
              <p className="dashboard-metric-value dashboard-metric-value--amber">
                {isLocked ? '---' : sharedItems}
              </p>
              <p className="dashboard-metric-desc mobile-hide">Shared secrets</p>
            </div>
            <div className="dashboard-metric-icon dashboard-metric-icon--amber">
              <Share2 size={20} />
            </div>
          </div>
        </Card>

      </div>

      {!isLocked && (
        <Card className="dashboard-breakdown-card" style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Shield size={18} color="var(--color-security-blue)" />
            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--color-text-main)', margin: 0 }}>
              Security Health Breakdown
            </h3>
          </div>
          <div className="grid-breakdown" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Account', value: breakdown.accountScore },
              { label: 'Passwords', value: breakdown.passwordScore },
              { label: 'Sharing', value: breakdown.sharingScore },
              { label: 'Sensitive Data', value: breakdown.sensitiveDataScore },
              { label: 'Integrity', value: breakdown.integrityScore },
            ].map((metric) => (
              <div key={metric.label} className="grid-breakdown-item">
                <div className="grid-breakdown-label">{metric.label}</div>
                <div className="grid-breakdown-value" style={{ color: metric.value >= 80 ? 'var(--color-soft-green)' : metric.value >= 50 ? 'var(--color-amber)' : 'var(--color-rose)' }}>
                  {metric.value}%
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
