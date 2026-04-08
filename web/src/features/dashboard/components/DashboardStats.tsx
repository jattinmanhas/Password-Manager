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
      <Card className="flex-responsive" style={{ 
        padding: '2rem', 
        marginBottom: '1.5rem',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        gap: '2.5rem',
        background: 'linear-gradient(135deg, var(--color-white) 0%, var(--color-bg-base) 100%)',
        border: '1px solid var(--color-border)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flex: 1 }}>
          <SecurityScoreGauge score={isLocked ? 0 : securityScore} size={110} strokeWidth={10} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <Shield size={20} color="var(--color-security-blue)" />
              <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--color-text-subtle)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Overall Security Health
              </h3>
            </div>
            <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-text-main)', margin: '0.25rem 0' }}>
              {isLocked ? 'Vault Encrypted' : (securityScore >= 80 ? 'Excellent Protection' : securityScore >= 50 ? 'Fair Security' : 'Security Risk Detected')}
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-subtle)', margin: 0, maxWidth: '500px' }}>
              {isLocked 
                ? 'Your vault is currently locked. Unlock with your master password to view detailed security metrics and health scores.' 
                : (securityScore >= 80 
                    ? 'Your score reflects account setup, password hygiene, sharing exposure, sensitive-data storage, and vault integrity.'
                    : 'This score now blends account posture, password hygiene, sharing exposure, sensitive-data storage, and vault integrity.')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '240px', maxWidth: '260px' }}>
          {!isLocked ? (
            <>
              <div style={{ padding: '0.75rem', borderRadius: '10px', backgroundColor: 'var(--color-emerald-subtle)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.625rem 0.75rem', borderRadius: '10px', backgroundColor: weakPasswords > 0 ? 'var(--color-rose-subtle)' : 'var(--color-emerald-subtle)', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <ShieldAlert size={14} color={weakPasswords > 0 ? 'var(--color-rose)' : 'var(--color-soft-green)'} />
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-main)' }}>
                    {weakPasswords} Weak
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.625rem 0.75rem', borderRadius: '10px', backgroundColor: reusedPasswords > 0 ? 'var(--color-amber-subtle)' : 'var(--color-emerald-subtle)', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <Shield size={14} color={reusedPasswords > 0 ? 'var(--color-amber)' : 'var(--color-soft-green)'} />
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-main)' }}>
                    {reusedPasswords} Reused
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.625rem 0.75rem', borderRadius: '10px', backgroundColor: corruptedItems > 0 ? 'var(--color-rose-subtle)' : 'var(--color-emerald-subtle)', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <AlertTriangle size={14} color={corruptedItems > 0 ? 'var(--color-rose)' : 'var(--color-soft-green)'} />
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-main)' }}>
                    {corruptedItems} Corrupt
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.625rem 0.75rem', borderRadius: '10px', backgroundColor: sharedItems > 0 ? 'var(--color-amber-subtle)' : 'var(--color-emerald-subtle)', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <Share2 size={14} color={sharedItems > 0 ? 'var(--color-amber)' : 'var(--color-soft-green)'} />
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-main)' }}>
                    {sharedItems} Shared
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
      <div className="dashboard-stats-grid grid-responsive" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '1.25rem'
      }}>
        {/* Total Items Card */}
        <Card style={{ padding: '1.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-text-subtle)', marginBottom: '0.5rem' }}>Vault Items</h3>
              <p style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--color-security-blue)', lineHeight: '1' }}>
                {isLocked ? '---' : totalItems}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '0.5rem' }}>
                {isLocked ? 'Vault is locked' : 'Total secrets encrypted'}
              </p>
            </div>
            <div style={{ 
              width: '40px', height: '40px', borderRadius: '12px', 
              backgroundColor: 'var(--color-blue-subtle)', color: 'var(--color-security-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Key size={20} />
            </div>
          </div>
        </Card>

        {/* Activity Stats Card */}
        <Card style={{ padding: '1.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-subtle)', marginBottom: '0.5rem' }}>Activity (24h)</h3>
              <p style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--color-soft-green)', lineHeight: '1' }}>{recentActivityCount}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '0.5rem' }}>Security events recorded</p>
            </div>
            <div style={{ 
              width: '40px', height: '40px', borderRadius: '12px', 
              backgroundColor: 'var(--color-emerald-subtle)', color: 'var(--color-soft-green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Clock size={20} />
            </div>
          </div>
        </Card>
        
        {/* Sharing Exposure Card */}
        <Card style={{ padding: '1.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--color-text-subtle)', marginBottom: '0.5rem' }}>Shared Exposure</h3>
              <p style={{ fontSize: '2.25rem', fontWeight: '800', color: !isLocked && sharedItems > 0 ? 'var(--color-amber)' : 'var(--color-soft-green)', lineHeight: '1' }}>
                {isLocked ? '---' : sharedItems}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '0.5rem' }}>
                {isLocked ? 'Encryption active' : 'Your secrets currently shared with others'}
              </p>
            </div>
            <div style={{ 
              width: '40px', height: '40px', borderRadius: '12px', 
              backgroundColor: sharedItems > 0 ? 'var(--color-amber-subtle)' : 'var(--color-emerald-subtle)', 
              color: sharedItems > 0 ? 'var(--color-amber)' : 'var(--color-soft-green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Share2 size={20} />
            </div>
          </div>
        </Card>

      </div>

      {!isLocked && (
        <Card style={{ padding: '1.25rem 1.5rem', marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Shield size={18} color="var(--color-security-blue)" />
            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--color-text-main)', margin: 0 }}>
              Security Health Breakdown
            </h3>
          </div>
          <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Account', value: breakdown.accountScore },
              { label: 'Passwords', value: breakdown.passwordScore },
              { label: 'Sharing', value: breakdown.sharingScore },
              { label: 'Sensitive Data', value: breakdown.sensitiveDataScore },
              { label: 'Integrity', value: breakdown.integrityScore },
            ].map((metric) => (
              <div key={metric.label} style={{ padding: '0.875rem', borderRadius: '12px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginBottom: '0.35rem' }}>{metric.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: metric.value >= 80 ? 'var(--color-soft-green)' : metric.value >= 50 ? 'var(--color-amber)' : 'var(--color-rose)' }}>
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
